import { supabase } from './supabaseClient';
import { Lesson } from '../types';
import { format, parseISO, addMinutes, parse, isValid } from 'date-fns';

// Define types for lesson data
export type SheetLesson = {
  studentName: string;
  duration: number;
  teacher: string;
  startDate: string;
  subject: string;
  row?: number; // Track the row number in the sheet for reference
};

export type DbLesson = {
  id: string;
  studentName: string;
  duration: number;
  teacherId: string | null;
  teacherName: string | null;
  day: number | null;
  startTime: string | null;
  subjectId: string;
  subjectName: string;
  startDate: string | null;
  endDate: string | null;
};

export type LessonMismatch = {
  type: 'missing_in_db' | 'missing_in_sheet' | 'mismatched';
  dbLesson?: DbLesson;
  sheetLesson?: SheetLesson;
  differences: string[];
};

export type ComparisonResult = {
  missingInDb: SheetLesson[];
  missingInSheet: DbLesson[];
  matched: {
    dbLesson: DbLesson;
    sheetLesson: SheetLesson;
  }[];
  mismatched: {
    dbLesson: DbLesson;
    sheetLesson: SheetLesson;
    differences: string[];
  }[];
};

// Check if aligning a mismatched lesson with Google Sheets would cause conflicts
export const wouldCauseConflict = async (dbLesson: DbLesson, sheetLesson: SheetLesson, schoolId: string): Promise<{
  hasConflict: boolean;
  conflictMessage: string | null;
}> => {
  try {
    // First, find the teacher ID for the sheet lesson's teacher name
    const { data: teachersData, error: teachersError } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', sheetLesson.teacher);
    
    if (teachersError) {
      console.error('Error finding teacher:', teachersError);
      return { hasConflict: true, conflictMessage: 'Error finding teacher: ' + teachersError.message };
    }
    
    // Filter teachers to only those who are teachers in this school
    let matchingTeacher = null;
    if (teachersData && teachersData.length > 0) {
      for (const teacher of teachersData) {
        const { data: teacherSchool, error: teacherSchoolError } = await supabase
          .from('user_schools')
          .select('role')
          .eq('user_id', teacher.id)
          .eq('school_id', schoolId)
          .eq('role', 'teacher')
          .single();
        
        if (!teacherSchoolError && teacherSchool) {
          matchingTeacher = teacher;
          break;
        }
      }
    }
    
    if (!matchingTeacher) {
      return { 
        hasConflict: true, 
        conflictMessage: `Teacher "${sheetLesson.teacher}" from Google Sheet not found in database.`
      };
    }
    
    const targetTeacherId = matchingTeacher.id;
    
    // Find the subject ID for the sheet lesson's subject name
    const { data: subjectsData, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, name')
      .ilike('name', sheetLesson.subject)
      .limit(1);
    
    if (subjectsError) {
      console.error('Error finding subject:', subjectsError);
      return { hasConflict: true, conflictMessage: 'Error finding subject: ' + subjectsError.message };
    }
    
    if (!subjectsData || subjectsData.length === 0) {
      return { 
        hasConflict: true, 
        conflictMessage: `Subject "${sheetLesson.subject}" from Google Sheet not found in database.`
      };
    }
    
    const targetSubjectId = subjectsData[0].id;
    
    // If the lesson is already assigned to a teacher and has a day/time
    if (dbLesson.teacherId && dbLesson.day !== null && dbLesson.startTime) {
      // Check for potential conflicts if we change the teacher or duration but keep the same day/time
      
      // If we're changing the teacher, we don't need to check for conflicts
      if (dbLesson.teacherId !== targetTeacherId) {
        // Different teacher, so no conflict with existing schedule
        return { hasConflict: false, conflictMessage: null };
      }
      
      // If we're keeping the same teacher but changing duration, check for conflicts
      if (dbLesson.duration !== sheetLesson.duration) {
        const { data: conflictingLessons, error: conflictError } = await supabase
          .from('lessons')
          .select('id, student_name, day_of_week, start_time, duration_minutes')
          .eq('teacher_id', targetTeacherId)
          .eq('day_of_week', dbLesson.day)
          .neq('id', dbLesson.id);
        
        if (conflictError) {
          console.error('Error checking conflicts:', conflictError);
          return { hasConflict: true, conflictMessage: 'Error checking conflicts: ' + conflictError.message };
        }
        
        if (conflictingLessons && conflictingLessons.length > 0) {
          // Calculate start and end minutes for the revised lesson
          const [currentHour, currentMinute] = dbLesson.startTime.split(':').map(Number);
          const startMinutes = currentHour * 60 + currentMinute;
          const endMinutes = startMinutes + sheetLesson.duration;
          
          // Check each potentially conflicting lesson
          for (const lesson of conflictingLessons) {
            if (!lesson.start_time) continue;
            
            const [lessonHour, lessonMinute] = lesson.start_time.split(':').map(Number);
            const lessonStartMinutes = lessonHour * 60 + lessonMinute;
            const lessonEndMinutes = lessonStartMinutes + lesson.duration_minutes;
            
            // Check for overlap
            if (startMinutes < lessonEndMinutes && endMinutes > lessonStartMinutes) {
              return {
                hasConflict: true,
                conflictMessage: `Changing duration to ${sheetLesson.duration} minutes would overlap with ${lesson.student_name}'s lesson.`
              };
            }
          }
        }
      }
    }
    
    // If we reach here, no conflicts were found
    return { hasConflict: false, conflictMessage: null };
  } catch (error) {
    console.error('Error in wouldCauseConflict:', error);
    return {
      hasConflict: true,
      conflictMessage: 'Unexpected error checking for conflicts: ' + (error.message || 'Unknown error')
    };
  }
};

// Function to update a lesson to match Google Sheet data
export const alignLessonWithSheet = async (dbLesson: DbLesson, sheetLesson: SheetLesson, schoolId: string): Promise<{
  success: boolean;
  message: string;
  updatedLesson?: DbLesson;
}> => {
  try {
    // Find the teacher ID based on the teacher name from Google Sheets
    const { data: teachersData, error: teachersError } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', sheetLesson.teacher);
    
    if (teachersError) throw new Error('Error finding teacher: ' + teachersError.message);
    
    // Filter teachers to only those who are teachers in this school
    let matchingTeacher = null;
    if (teachersData && teachersData.length > 0) {
      for (const teacher of teachersData) {
        const { data: teacherSchool, error: teacherSchoolError } = await supabase
          .from('user_schools')
          .select('role')
          .eq('user_id', teacher.id)
          .eq('school_id', schoolId)
          .eq('role', 'teacher')
          .single();
        
        if (!teacherSchoolError && teacherSchool) {
          matchingTeacher = teacher;
          break;
        }
      }
    }
    
    if (!matchingTeacher) {
      throw new Error(`Teacher "${sheetLesson.teacher}" not found in database.`);
    }
    
    const targetTeacherId = matchingTeacher.id;
    
    // Find the subject ID for the sheet lesson's subject name
    const { data: subjectsData, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, name')
      .ilike('name', sheetLesson.subject)
      .limit(1);
    
    if (subjectsError) throw new Error('Error finding subject: ' + subjectsError.message);
    if (!subjectsData || subjectsData.length === 0) {
      throw new Error(`Subject "${sheetLesson.subject}" not found in database.`);
    }
    
    const targetSubjectId = subjectsData[0].id;
    
    // Create the update data
    const updateData = {
      student_name: sheetLesson.studentName,
      duration_minutes: sheetLesson.duration,
      teacher_id: targetTeacherId,
      subject_id: targetSubjectId,
      start_date: sheetLesson.startDate,
      // Keep the existing day_of_week, start_time, and end_date
      day_of_week: dbLesson.day,
      start_time: dbLesson.startTime,
      end_date: dbLesson.endDate
    };
    
    // Update the lesson in the database
    const { data, error: updateError } = await supabase
      .from('lessons')
      .update(updateData)
      .eq('id', dbLesson.id)
      .select(`
        id, 
        student_name, 
        duration_minutes, 
        teacher_id, 
        teachers:teacher_id (name), 
        day_of_week, 
        start_time, 
        subject_id, 
        subjects:subject_id (name, color), 
        start_date, 
        end_date
      `)
      .single();
    
    if (updateError) throw new Error('Error updating lesson: ' + updateError.message);
    
    // Type the response correctly
    interface DbResponse {
      id: string;
      student_name: string;
      duration_minutes: number;
      teacher_id: string | null;
      teachers: { name: string } | null;
      day_of_week: number | null;
      start_time: string | null;
      subject_id: string;
      subjects: { name: string; color: string } | null;
      start_date: string | null;
      end_date: string | null;
    }
    
    // Cast the data to the right type
    const typedData = data as unknown as DbResponse;
    
    // Map the response to our DbLesson type
    const updatedLesson: DbLesson = {
      id: typedData.id,
      studentName: typedData.student_name,
      duration: typedData.duration_minutes,
      teacherId: typedData.teacher_id,
      teacherName: typedData.teachers ? typedData.teachers.name : null,
      day: typedData.day_of_week,
      startTime: typedData.start_time,
      subjectId: typedData.subject_id,
      subjectName: typedData.subjects ? typedData.subjects.name : 'Unknown Subject',
      startDate: typedData.start_date,
      endDate: typedData.end_date
    };
    
    return {
      success: true,
      message: 'Lesson successfully aligned with Google Sheet data',
      updatedLesson
    };
  } catch (error) {
    console.error('Error aligning lesson with Google Sheet:', error);
    return {
      success: false,
      message: error.message || 'Failed to align lesson with Google Sheet data'
    };
  }
};

// Function to fetch lessons from Google Sheets
export const fetchGoogleSheetLessons = async (schoolId: string): Promise<SheetLesson[]> => {
  try {
    console.log('Calling Edge Function to fetch Google Sheet lessons...');
    
    // Call Supabase Edge Function to get Google Sheet data
    const response = await supabase.functions.invoke('get-google-sheet-lessons', {
      method: 'POST',
      body: JSON.stringify({ school_id: schoolId })
    });
    
    console.log('Edge Function response received:', { 
      hasError: response.error !== null,
      errorMessage: response.error ? response.error.message : null,
      dataLength: response.data ? (Array.isArray(response.data) ? response.data.length : 'not array') : 'no data'
    });
    
    if (response.error) {
      console.error('Error from Edge Function:', response.error);
      throw new Error(`Edge Function error: ${response.error.message}`);
    }
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('Invalid response format from Edge Function:', response.data);
      throw new Error('No lesson data received from Google Sheets');
    }
    
    if (response.data.length === 0) {
      console.warn('No lessons found in Google Sheet');
      return [];
    }
    
    // Log sample data for debugging
    console.log('Sample Google Sheet data:', response.data.slice(0, 2));
    
    // Transform the data to match our expected format
    return response.data.map((row: any, index: number) => {
      const lesson = {
        studentName: row.studentName || '',
        duration: typeof row.duration === 'number' ? row.duration : 
                  parseInt(String(row.duration), 10) || 0,
        teacher: row.teacher || '',
        startDate: row.startDate || '',
        subject: row.subject || '',
        row: index + 2 // +2 because index 0 is row 2 (after header row)
      };
      
      // Validate lesson data
      if (!lesson.studentName) {
        console.warn(`Missing student name in sheet lesson at row ${index + 2}`);
      }
      if (!lesson.subject) {
        console.warn(`Missing subject in sheet lesson for ${lesson.studentName || 'unnamed student'}`);
      }
      
      return lesson;
    });
  } catch (err) {
    console.error('Error fetching Google Sheet lessons:', err);
    throw err;
  }
};

// Function to fetch lessons from the database
export const fetchDatabaseLessons = async (schoolId: string): Promise<DbLesson[]> => {
  try {
    console.log('Fetching lessons from database...');
    // Get all lessons from the database for the specific school
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .eq('school_id', schoolId);
    
    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
      throw new Error(`Failed to fetch lessons from database: ${lessonsError.message}`);
    }

    console.log(`Retrieved ${lessonsData?.length || 0} lessons from database`);
    
    // Check specifically for Liam in raw data
    const liamLessonsRaw = lessonsData?.filter(lesson => 
      lesson.student_name?.includes('Liam') || lesson.studentName?.includes('Liam')
    );
    console.log('Raw Liam lessons from DB:', liamLessonsRaw);
    
    // Log the first lesson to see the structure
    if (lessonsData && lessonsData.length > 0) {
      console.log('Sample database lesson (raw):', lessonsData[0]);
      console.log('Fields available in raw lesson data:', Object.keys(lessonsData[0]));
    }

    // Get all subjects for this school
    console.log('Fetching subjects from database...');
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('school_id', schoolId);
    
    if (subjectsError) {
      console.error('Error fetching subjects:', subjectsError);
      throw new Error(`Failed to fetch subjects from database: ${subjectsError.message}`);
    }

    console.log(`Retrieved ${subjects?.length || 0} subjects from database`);
    console.log('All subjects:', subjects);

    // Get all teachers for this school
    console.log('Fetching teachers from database...');
    
    // Type definition for teacher response
    type TeacherResponse = {
      id: string;
      name: string;
    };
    
    // Use the database function to get teachers (bypasses RLS safely)
    const { data: teachersData, error: teachersError } = await supabase
      .rpc('get_school_teachers', { target_school_id: schoolId });
    
    if (teachersError) {
      console.error('Error fetching teachers:', teachersError);
      throw new Error(`Failed to fetch teachers from database: ${teachersError.message}`);
    }

    console.log(`Retrieved ${teachersData?.length || 0} teachers from database`);
    console.log('All teachers:', teachersData);
    
    // Cast to proper type
    const teachers = (teachersData || []) as TeacherResponse[];

    // Log data for debugging
    console.log(`Raw DB Data: ${lessonsData.length} lessons, ${subjects.length} subjects, ${teachers.length} teachers`);
    
    // Create lookup maps for subjects and teachers
    const subjectMap = new Map(subjects.map(i => [i.id, i.name]));
    const teacherMap = new Map(teachers.map(t => [t.id, t.name]));
    
    console.log('Subject map has', subjectMap.size, 'entries');
    console.log('Teacher map has', teacherMap.size, 'entries');
    
    // Map subject IDs to names
    console.log('First few subject map entries:', Array.from(subjectMap.entries()).slice(0, 3));
    
    // Transform the data to match our expected format
    const mappedLessons = lessonsData.map((lesson: any) => {
      // Extract student name from appropriate field
      const studentName = lesson.studentName || lesson.student_name || 'Unnamed Student';
      
      // Log subject details to debug mapping
      const subjectId = lesson.subjectId || lesson.subject_id;
      console.log(`Subject ID for lesson ${lesson.id}:`, subjectId);
      
      // Get subject name from map - extra logging for Liam
      const subjectName = subjectId && subjectMap.has(subjectId) 
        ? subjectMap.get(subjectId) 
        : 'Unknown Subject';
        
      if (studentName.includes('Liam')) {
        console.log(`Subject lookup for Liam's lesson:`, {
          lessonId: lesson.id,
          subjectId,
          foundInMap: subjectId ? subjectMap.has(subjectId) : false,
          mapResult: subjectId ? subjectMap.get(subjectId) : null
        });
      }
      
      // Get teacher ID from appropriate field
      const teacherId = lesson.teacherId || lesson.teacher_id;
      
      // Get teacher name from map
      const teacherName: string | null = teacherId && teacherMap.has(teacherId)
        ? teacherMap.get(teacherId) || null
        : null;
      
      // Specifically log Liam-related lessons
      if (studentName.includes('Liam')) {
        console.log('Found Liam lesson in DB mapping step:', { 
          id: lesson.id, 
          studentName,
          subjectId,
          subjectName,
          teacherId,
          teacherName,
          rawLesson: lesson
        });
      }
      
      // Create mapped lesson object
      const mappedLesson = {
        id: lesson.id || 'unknown-id',
        studentName: studentName,
        duration: typeof lesson.duration === 'number' ? lesson.duration : 
                 typeof lesson.duration_minutes === 'number' ? lesson.duration_minutes : 0,
        teacherId: teacherId,
        teacherName: teacherName,
        day: lesson.day || lesson.day_of_week,
        startTime: lesson.startTime || lesson.start_time,
        subjectId: subjectId || '',
        subjectName: subjectName,
        startDate: lesson.startDate || lesson.start_date,
        endDate: lesson.endDate || lesson.end_date
      };
      
      return mappedLesson;
    });
    
    // Log total mapping results
    console.log(`Successfully mapped ${mappedLessons.length} lessons from database`);
    
    return mappedLessons;
  } catch (err) {
    console.error('Error in fetchDatabaseLessons:', err);
    throw err;
  }
};

// Helper function to normalize dates for comparison
const normalizeDateForComparison = (dateString: string | null | undefined): string | null => {
  if (!dateString || dateString.trim() === '') {
    return null;
  }
  
  const trimmed = dateString.trim();
  
  try {
    // Try to parse as ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const date = parseISO(trimmed);
      if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
      }
    }
    
    // Try to parse as European format (DD/MM/YYYY)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const date = parse(trimmed, 'dd/MM/yyyy', new Date());
      if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
      }
    }
    
    // Try to parse as American format (MM/DD/YYYY)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const date = parse(trimmed, 'MM/dd/yyyy', new Date());
      if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
      }
    }
    
    // If none of the formats work, return the original string
    console.warn('Could not parse date:', trimmed);
    return trimmed;
  } catch (error) {
    console.warn('Error parsing date:', trimmed, error);
    return trimmed;
  }
};

// Helper function to check if two lessons are considered the same
const isSameLesson = (dbLesson: DbLesson, sheetLesson: SheetLesson): boolean => {
  // Add debug logging for Liam Duque Sanz
  if ((dbLesson?.studentName && dbLesson.studentName.includes('Liam')) || 
      (sheetLesson?.studentName && sheetLesson.studentName.includes('Liam'))) {
    console.log('Found Liam lesson - DETAILED COMPARISON:', { 
      dbLesson: { 
        id: dbLesson?.id,
        studentName: dbLesson?.studentName,
        duration: dbLesson?.duration,
        subjectName: dbLesson?.subjectName,
        teacherName: dbLesson?.teacherName,
        startDate: dbLesson?.startDate
      }, 
      sheetLesson: {
        studentName: sheetLesson?.studentName,
        duration: sheetLesson?.duration,
        subject: sheetLesson?.subject,
        teacher: sheetLesson?.teacher,
        startDate: sheetLesson?.startDate
      }
    });
  }
  
  // Check for null or undefined values first
  if (!dbLesson?.studentName || !sheetLesson?.studentName || 
      dbLesson.duration === undefined || sheetLesson.duration === undefined ||
      !dbLesson?.subjectName || !sheetLesson?.subject) {
    console.log('Missing required properties for comparison, returning false');
    return false;
  }
  
  // Basic match on student name, duration and subject (with more flexible matching)
  // For student name, we'll use a more relaxed comparison that ignores case and some special characters
  const normalizeStudentName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/gi, '') // Remove special characters
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();                 // Trim whitespace
  };
  
  const dbStudentNormalized = normalizeStudentName(dbLesson.studentName);
  const sheetStudentNormalized = normalizeStudentName(sheetLesson.studentName);
  
  // For Liam Duque Sanz, add special debug logging
  if (dbStudentNormalized.includes('liam') || sheetStudentNormalized.includes('liam')) {
    console.log('Normalized name comparison for Liam:', {
      original: {
        db: dbLesson.studentName,
        sheet: sheetLesson.studentName
      },
      normalized: {
        db: dbStudentNormalized,
        sheet: sheetStudentNormalized
      },
      matches: dbStudentNormalized === sheetStudentNormalized
    });
  }
  
  const studentNameMatch = dbStudentNormalized === sheetStudentNormalized;
  const durationMatch = Number(dbLesson.duration) === Number(sheetLesson.duration);
  const subjectMatch = 
    dbLesson.subjectName.toLowerCase() === sheetLesson.subject.toLowerCase();
  
  // We consider it a full match if all three criteria match
  const isMatch = studentNameMatch && durationMatch && subjectMatch;
  
  // For Liam lessons, log the result of each comparison
  if (dbStudentNormalized.includes('liam') || sheetStudentNormalized.includes('liam')) {
    console.log('Liam lesson match details:', {
      studentNameMatch,
      durationMatch,
      subjectMatch,
      isFullMatch: isMatch
    });
  }
  
  return isMatch;
};

// Helper function to check if lessons partially match (for moving to mismatched instead of missing)
const isPartialMatch = (dbLesson: DbLesson, sheetLesson: SheetLesson): boolean => {
  // Check for null or undefined values first
  if (!dbLesson?.studentName || !sheetLesson?.studentName) {
    return false;
  }
  
  // Use the same normalization as in isSameLesson
  const normalizeStudentName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/gi, '') // Remove special characters
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();                 // Trim whitespace
  };
  
  const dbStudentNormalized = normalizeStudentName(dbLesson.studentName);
  const sheetStudentNormalized = normalizeStudentName(sheetLesson.studentName);
  
  // Basic match on student name, duration and subject
  const studentNameMatch = dbStudentNormalized === sheetStudentNormalized;
  const durationMatch = Number(dbLesson.duration) === Number(sheetLesson.duration);
  const subjectMatch = 
    dbLesson.subjectName && sheetLesson.subject &&
    dbLesson.subjectName.toLowerCase() === sheetLesson.subject.toLowerCase();
  
  // Log for Liam Duque Sanz
  if (dbLesson.studentName.includes('Liam') || 
      sheetLesson.studentName.includes('Liam')) {
    console.log('Liam Duque Sanz partial match check:', {
      studentNameMatch,
      durationMatch, 
      subjectMatch,
      dbName: dbLesson.studentName,
      sheetName: sheetLesson.studentName,
      dbNameNormalized: dbStudentNormalized,
      sheetNameNormalized: sheetStudentNormalized,
      dbDuration: dbLesson.duration,
      sheetDuration: sheetLesson.duration,
      dbSubject: dbLesson.subjectName,
      sheetSubject: sheetLesson.subject
    });
  }
  
  // Consider it a partial match if student name matches AND (duration or subject matches)
  const isPartial = studentNameMatch && (durationMatch || subjectMatch);
  
  if (dbStudentNormalized.includes('liam') || sheetStudentNormalized.includes('liam')) {
    console.log('Liam lesson partial match result:', isPartial);
  }
  
  return isPartial;
};

// Find differences between a database lesson and a sheet lesson
const findDifferences = (dbLesson: DbLesson, sheetLesson: SheetLesson): string[] => {
  const differences: string[] = [];
  
  // Check each field that we care about
  if (dbLesson.studentName.toLowerCase() !== sheetLesson.studentName.toLowerCase()) {
    differences.push(`Student name mismatch: "${dbLesson.studentName}" in DB vs "${sheetLesson.studentName}" in Sheet`);
  }
  
  if (dbLesson.duration !== sheetLesson.duration) {
    differences.push(`Duration mismatch: "${dbLesson.duration}" in DB vs "${sheetLesson.duration}" in Sheet`);
  }
  
  if (dbLesson.subjectName.toLowerCase() !== sheetLesson.subject.toLowerCase()) {
    differences.push(`Subject mismatch: "${dbLesson.subjectName}" in DB vs "${sheetLesson.subject}" in Sheet`);
  }
  
  // Compare teacher (handling null case)
  const dbTeacher = dbLesson.teacherName || 'Unassigned';
  if (dbTeacher.toLowerCase() !== sheetLesson.teacher.toLowerCase()) {
    differences.push(`Teacher mismatch: "${dbTeacher}" in DB vs "${sheetLesson.teacher}" in Sheet`);
  }
  
  // Compare start dates with normalization (handling null case and different formats)
  const normalizedDbDate = normalizeDateForComparison(dbLesson.startDate);
  const normalizedSheetDate = normalizeDateForComparison(sheetLesson.startDate);
  
  if (normalizedDbDate !== normalizedSheetDate) {
    differences.push(`Start date mismatch: "${dbLesson.startDate || 'Not set'}" in DB vs "${sheetLesson.startDate}" in Sheet`);
  }
  
  // Special logging for Liam Duque Sanz - 2º C
  if (dbLesson.studentName.includes('Liam Duque Sanz') || 
      sheetLesson.studentName.includes('Liam Duque Sanz')) {
    console.log('Liam Duque Sanz differences:', differences);
  }
  
  return differences;
};

// Helper function to find the best match when multiple candidates exist
const findBestMatch = (dbLesson: DbLesson, candidateSheetLessons: SheetLesson[]): SheetLesson => {
  if (candidateSheetLessons.length === 1) {
    return candidateSheetLessons[0];
  }
  
  // Tiebreaker 1: Teacher match (if both lessons have teachers assigned)
  if (dbLesson.teacherName) {
    const teacherMatches = candidateSheetLessons.filter(sheet => 
      sheet.teacher && 
      dbLesson.teacherName!.toLowerCase() === sheet.teacher.toLowerCase()
    );
    
    if (teacherMatches.length === 1) {
      return teacherMatches[0];
    }
    
    // If we have teacher matches, continue with those for next tiebreaker
    if (teacherMatches.length > 1) {
      candidateSheetLessons = teacherMatches;
    }
  }
  
  // Tiebreaker 2: Start date match (if both lessons have start dates)
  if (dbLesson.startDate) {
    const dateMatches = candidateSheetLessons.filter(sheet => 
      sheet.startDate && dbLesson.startDate === sheet.startDate
    );
    
    if (dateMatches.length > 0) {
      return dateMatches[0];
    }
  }
  
  // Fallback: Return first candidate
  return candidateSheetLessons[0];
};

// Helper function to process matches and remove matched pairs from working arrays
const processMatches = (
  workingDbLessons: DbLesson[],
  workingSheetLessons: SheetLesson[],
  matchFunction: (db: DbLesson, sheet: SheetLesson) => boolean,
  perfectMatches: { dbLesson: DbLesson; sheetLesson: SheetLesson }[],
  mismatchedResults: { dbLesson: DbLesson; sheetLesson: SheetLesson; differences: string[] }[],
  matchType: 'exact' | 'partial'
): { updatedDbLessons: DbLesson[]; updatedSheetLessons: SheetLesson[] } => {
  const processedDbIndices = new Set<number>();
  const processedSheetIndices = new Set<number>();
  
  // For each DB lesson, find all matching sheet lessons
  workingDbLessons.forEach((dbLesson, dbIndex) => {
    if (processedDbIndices.has(dbIndex)) return;
    
    const matchingSheetLessons: { lesson: SheetLesson; index: number }[] = [];
    
    workingSheetLessons.forEach((sheetLesson, sheetIndex) => {
      if (processedSheetIndices.has(sheetIndex)) return;
      
      if (matchFunction(dbLesson, sheetLesson)) {
        matchingSheetLessons.push({ lesson: sheetLesson, index: sheetIndex });
      }
    });
    
    // If we found matches, pick the best one using tiebreaker
    if (matchingSheetLessons.length > 0) {
      const bestMatch = findBestMatch(
        dbLesson, 
        matchingSheetLessons.map(m => m.lesson)
      );
      
      const bestMatchIndex = matchingSheetLessons.find(m => m.lesson === bestMatch)!.index;
      
      // Check for differences and categorize accordingly
      const differences = findDifferences(dbLesson, bestMatch);
      
      if (differences.length === 0) {
        // Perfect match - no differences
        perfectMatches.push({ dbLesson, sheetLesson: bestMatch });
      } else {
        // Has differences - add to mismatched
        mismatchedResults.push({ dbLesson, sheetLesson: bestMatch, differences });
      }
      
      // Mark as processed
      processedDbIndices.add(dbIndex);
      processedSheetIndices.add(bestMatchIndex);
    }
  });
  
  // Return updated arrays with matched lessons removed
  const updatedDbLessons = workingDbLessons.filter((_, index) => !processedDbIndices.has(index));
  const updatedSheetLessons = workingSheetLessons.filter((_, index) => !processedSheetIndices.has(index));
  
  return { updatedDbLessons, updatedSheetLessons };
};

// Main comparison function
export const compareLessons = async (schoolId: string): Promise<ComparisonResult> => {
  try {
    // Fetch data from both sources
    console.log('Fetching database lessons...');
    const dbLessons = await fetchDatabaseLessons(schoolId);
    console.log(`Retrieved ${dbLessons.length} database lessons`);
    
    console.log('Fetching Google Sheet lessons...');
    const sheetLessons = await fetchGoogleSheetLessons(schoolId);
    console.log(`Retrieved ${sheetLessons.length} Google Sheet lessons`);
    
    // Log sample data to help debug
    if (dbLessons.length > 0) {
      console.log('Sample DB lesson:', dbLessons[0]);
    } else {
      console.warn('No database lessons found!');
    }
    
    if (sheetLessons.length > 0) {
      console.log('Sample Sheet lesson:', sheetLessons[0]);
    } else {
      console.warn('No Google Sheet lessons found!');
    }
    
    // Validate data before processing - only include lessons with sufficient data
    const validDbLessons = dbLessons.filter(lesson => {
      const isValid = lesson && 
        lesson.studentName && 
        lesson.studentName !== 'Unnamed Student';
      
      if (!isValid) {
        console.log('Excluding invalid DB lesson:', {
          id: lesson?.id,
          studentName: lesson?.studentName
        });
      }
      
      return isValid;
    });
    
    const validSheetLessons = sheetLessons.filter(lesson => {
      const isValid = lesson && 
        lesson.studentName && 
        lesson.studentName.trim() !== '';
      
      if (!isValid) {
        console.log('Excluding invalid Sheet lesson:', {
          studentName: lesson?.studentName
        });
      }
      
      return isValid;
    });
    
    console.log(`Valid lessons: ${validDbLessons.length}/${dbLessons.length} DB, ${validSheetLessons.length}/${sheetLessons.length} Sheet`);
    
    // If either source has no valid lessons, log a warning
    if (validDbLessons.length === 0) {
      console.warn('No valid database lessons found for comparison');
    }
    
    if (validSheetLessons.length === 0) {
      console.warn('No valid Google Sheet lessons found for comparison');
    }
    
    // Create working copies (deep clone) for the greedy removal algorithm
    let workingDbLessons = [...validDbLessons];
    let workingSheetLessons = [...validSheetLessons];
    
    // Prepare result structure
    const result: ComparisonResult = {
      missingInDb: [],
      missingInSheet: [],
      matched: [],
      mismatched: []
    };
    
    console.log('Starting improved greedy removal algorithm...');
    
    // ROUND 1: Process exact matches (name + duration + instrument)
    console.log('Round 1: Processing exact matches...');
    const round1Result = processMatches(
      workingDbLessons,
      workingSheetLessons,
      isSameLesson,
      result.matched,
      result.mismatched,
      'exact'
    );
    
    // Update working arrays
    workingDbLessons = round1Result.updatedDbLessons;
    workingSheetLessons = round1Result.updatedSheetLessons;
    
    console.log(`After Round 1: ${result.matched.length} perfect matches, ${result.mismatched.length} mismatches`);
    console.log(`Remaining: ${workingDbLessons.length} DB lessons, ${workingSheetLessons.length} Sheet lessons`);
    
    // ROUND 2: Process partial matches on remaining lessons
    console.log('Round 2: Processing partial matches...');
    const tempPartialMatches: { dbLesson: DbLesson; sheetLesson: SheetLesson }[] = [];
    const round2Result = processMatches(
      workingDbLessons,
      workingSheetLessons,
      isPartialMatch,
      tempPartialMatches, // Partial matches that are perfect (shouldn't happen, but for type safety)
      result.mismatched,  // All partial matches will have differences
      'partial'
    );
    
    // Update working arrays
    workingDbLessons = round2Result.updatedDbLessons;
    workingSheetLessons = round2Result.updatedSheetLessons;
    
    console.log(`After Round 2: ${result.mismatched.length} total mismatches`);
    console.log(`Remaining: ${workingDbLessons.length} DB lessons, ${workingSheetLessons.length} Sheet lessons`);
    
    // ROUND 3: Whatever remains is truly unmatched
    result.missingInDb = [...workingSheetLessons];
    result.missingInSheet = [...workingDbLessons];
    
    console.log('Improved comparison summary:', {
      originalDbLessonsCount: dbLessons.length,
      originalSheetLessonsCount: sheetLessons.length,
      validDbLessonsCount: validDbLessons.length,
      validSheetLessonsCount: validSheetLessons.length,
      perfectMatches: result.matched.length,
      mismatches: result.mismatched.length,
      missingInDb: result.missingInDb.length,
      missingInSheet: result.missingInSheet.length,
      totalProcessed: result.matched.length + result.mismatched.length + result.missingInDb.length + result.missingInSheet.length
    });
    
    return result;
  } catch (err) {
    console.error('Error comparing lessons:', err);
    throw err;
  }
}; 