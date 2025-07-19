import { supabase } from './supabaseClient';
import { Lesson } from '../types';
import { format, parseISO, addMinutes, parse, isValid, startOfWeek, addDays } from 'date-fns';

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
    // Use the database function to get teachers (bypasses RLS safely)
    const { data: teachersData, error: teachersError } = await supabase
      .rpc('get_school_teachers_for_module', { 
        target_school_id: schoolId,
        target_module_name: 'scheduler'
      });
    
    if (teachersError) {
      console.error('Error finding teachers:', teachersError);
      return { hasConflict: true, conflictMessage: 'Error finding teachers: ' + teachersError.message };
    }
    
    // Find teacher by name (case-insensitive)
    const matchingTeacher = teachersData?.find((teacher: any) => 
      teacher.name.toLowerCase() === sheetLesson.teacher.toLowerCase()
    );
    
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

// Helper function to check for scheduling conflicts before updating a lesson
const checkForSchedulingConflicts = async (
  lessonData: any,
  excludeLessonId: string,
  schoolId: string
): Promise<{ hasConflict: boolean; conflictMessage: string | null }> => {
  try {
    // Check for lessons with the same student that might overlap
    const { data: conflictingLessons, error } = await supabase
      .from('lessons')
      .select('id, student_name, day_of_week, start_time, duration_minutes, start_date, end_date')
      .eq('school_id', schoolId)
      .eq('student_name', lessonData.student_name)
      .eq('day_of_week', lessonData.day_of_week)
      .eq('start_time', lessonData.start_time)
      .neq('id', excludeLessonId); // Exclude the lesson being updated
    
    if (error) {
      console.warn('Error checking for conflicts:', error);
      return { hasConflict: false, conflictMessage: null };
    }
    
    if (!conflictingLessons || conflictingLessons.length === 0) {
      return { hasConflict: false, conflictMessage: null };
    }
    
    // Check for date range overlaps
    const proposedStart = new Date(lessonData.start_date);
    const proposedEnd = new Date(lessonData.end_date);
    
    for (const conflict of conflictingLessons) {
      const conflictStart = new Date(conflict.start_date);
      const conflictEnd = new Date(conflict.end_date);
      
      // Check if date ranges overlap
      const hasOverlap = proposedStart <= conflictEnd && proposedEnd >= conflictStart;
      
      if (hasOverlap) {
        return {
          hasConflict: true,
          conflictMessage: `Overlapping lesson found: ${conflict.student_name} on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][conflict.day_of_week]} at ${conflict.start_time} (${formatDateRange(conflict.start_date, conflict.end_date)})`
        };
      }
    }
    
    return { hasConflict: false, conflictMessage: null };
  } catch (error) {
    console.error('Error in checkForSchedulingConflicts:', error);
    return {
      hasConflict: true,
      conflictMessage: 'Error checking for conflicts: ' + (error.message || 'Unknown error')
    };
  }
};

// Helper function to format date range for display
const formatDateRange = (startDate: string, endDate: string): string => {
  try {
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    return `${start} - ${end}`;
  } catch {
    return `${startDate} - ${endDate}`;
  }
};

// Function to update a lesson to match Google Sheet data
export const alignLessonWithSheet = async (dbLesson: DbLesson, sheetLesson: SheetLesson, schoolId: string): Promise<{
  success: boolean;
  message: string;
  updatedLesson?: DbLesson;
}> => {
  try {
    // Use the database function to get teachers (bypasses RLS safely)
    const { data: teachersData, error: teachersError } = await supabase
      .rpc('get_school_teachers_for_module', { 
        target_school_id: schoolId,
        target_module_name: 'scheduler'
      });
    
    if (teachersError) throw new Error('Error finding teachers: ' + teachersError.message);
    
    // Find teacher by name (case-insensitive)
    const matchingTeacher = teachersData?.find((teacher: any) => 
      teacher.name.toLowerCase() === sheetLesson.teacher.toLowerCase()
    );
    
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
    
    // NEW: Check for conflicts before updating
    const conflictCheck = await checkForSchedulingConflicts(
      updateData,
      dbLesson.id, // Exclude the current lesson from conflict check
      schoolId
    );
    
    if (conflictCheck.hasConflict) {
      console.warn(`🚫 Alignment blocked to prevent overlap:`, {
        student: sheetLesson.studentName,
        proposedUpdate: updateData,
        conflictReason: conflictCheck.conflictMessage
      });
      return {
        success: false,
        message: `Cannot align lesson: ${conflictCheck.conflictMessage}. This would create overlapping lessons for the same student.`
      };
    }
    
    // Update the lesson in the database
    const { data, error: updateError } = await supabase
      .from('lessons')
      .update(updateData)
      .eq('id', dbLesson.id)
      .select('*')
      .single();
    
    if (updateError) throw new Error('Error updating lesson: ' + updateError.message);
    
    // Create the updated lesson response using the data we already have
    const updatedLesson: DbLesson = {
      id: data.id,
      studentName: data.student_name,
      duration: data.duration_minutes,
      teacherId: data.teacher_id,
      teacherName: matchingTeacher.name, // Use the teacher name we already found
      day: data.day_of_week,
      startTime: data.start_time,
      subjectId: data.subject_id,
      subjectName: subjectsData[0].name, // Use the subject name we already found
      startDate: data.start_date,
      endDate: data.end_date
    };
    
    // Log successful alignment for debugging
    console.log(`✅ Lesson aligned successfully:`, {
      student: updatedLesson.studentName,
      lessonId: updatedLesson.id,
      changes: Object.keys(updateData),
      newDateRange: formatDateRange(updatedLesson.startDate, updatedLesson.endDate)
    });
    
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
    // ONLY include currently active lessons (no end date OR end date >= today)
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .eq('school_id', schoolId)
      .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0]);
    
    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
      throw new Error(`Failed to fetch lessons from database: ${lessonsError.message}`);
    }

    console.log(`Retrieved ${lessonsData?.length || 0} active lessons from database`);
    
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
      .rpc('get_school_teachers_for_module', { 
        target_school_id: schoolId,
        target_module_name: 'scheduler'
      });
    
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

// Helper function to calculate match score between database and sheet lessons
const calculateMatchScore = (dbLesson: DbLesson, sheetLesson: SheetLesson): number => {
  let score = 0;
  
  // Student name matching (most important) - 3 points
  const normalizeStudentName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/gi, '') // Remove special characters
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();                 // Trim whitespace
  };
  
  const dbStudentNormalized = normalizeStudentName(dbLesson.studentName);
  const sheetStudentNormalized = normalizeStudentName(sheetLesson.studentName);
  const studentNameMatch = dbStudentNormalized === sheetStudentNormalized;
  
  if (studentNameMatch) score += 3;
  
  // Duration matching - 2 points
  const durationMatch = Number(dbLesson.duration) === Number(sheetLesson.duration);
  if (durationMatch) score += 2;
  
  // Subject matching - 2 points
  const subjectMatch = dbLesson.subjectName && sheetLesson.subject &&
    dbLesson.subjectName.toLowerCase() === sheetLesson.subject.toLowerCase();
  if (subjectMatch) score += 2;
  
  // Teacher matching - 0.5 points
  const dbTeacher = dbLesson.teacherName || '';
  const teacherMatch = dbTeacher.toLowerCase() === sheetLesson.teacher.toLowerCase();
  if (teacherMatch) score += 0.5;
  
  // Date matching - 0.5 points
  const normalizedDbDate = normalizeDateForComparison(dbLesson.startDate);
  const normalizedSheetDate = normalizeDateForComparison(sheetLesson.startDate);
  const dateMatch = normalizedDbDate === normalizedSheetDate;
  if (dateMatch) score += 0.5;
  
  // NEW: Date range proximity scoring - up to 2 points
  // This helps prevent multiple lessons from matching the same sheet entry
  const dateRangeScore = calculateDateRangeProximity(dbLesson, sheetLesson);
  score += dateRangeScore;
  
  return score;
};

// Helper function to calculate date range proximity score
const calculateDateRangeProximity = (dbLesson: DbLesson, sheetLesson: SheetLesson): number => {
  try {
    const dbStart = new Date(dbLesson.startDate);
    const dbEnd = new Date(dbLesson.endDate);
    const sheetStart = new Date(sheetLesson.startDate);
    
    // If sheet lesson starts within the DB lesson's date range, perfect match
    if (sheetStart >= dbStart && sheetStart <= dbEnd) {
      return 2.0; // Maximum points for perfect overlap
    }
    
    // Calculate distance from sheet start to closest point in DB range
    let distance: number;
    if (sheetStart < dbStart) {
      distance = Math.abs(dbStart.getTime() - sheetStart.getTime());
    } else {
      distance = Math.abs(sheetStart.getTime() - dbEnd.getTime());
    }
    
    // Convert distance to days
    const daysDifference = distance / (1000 * 60 * 60 * 24);
    
    // Score decreases exponentially with distance
    // 0-7 days: 1.5-1.0 points
    // 8-30 days: 1.0-0.5 points  
    // 31+ days: 0.5-0 points
    if (daysDifference <= 7) {
      return 1.5 - (daysDifference / 7) * 0.5; // 1.5 to 1.0
    } else if (daysDifference <= 30) {
      return 1.0 - ((daysDifference - 7) / 23) * 0.5; // 1.0 to 0.5
    } else if (daysDifference <= 90) {
      return 0.5 - ((daysDifference - 30) / 60) * 0.5; // 0.5 to 0.0
    } else {
      return 0; // Too far apart
    }
  } catch (error) {
    console.warn('Error calculating date range proximity:', error);
    return 0;
  }
};

// Helper function to check if two lessons are considered the same (minimum threshold)
const isSameLesson = (dbLesson: DbLesson, sheetLesson: SheetLesson): boolean => {
  // A lesson is considered "same" if it has a score of at least 8
  // Core required: 3 (student) + 2 (duration) + 2 (subject) = 7
  // Plus some date range proximity: +1 minimum = 8 total
  // This prevents lessons with very distant date ranges from matching
  const score = calculateMatchScore(dbLesson, sheetLesson);
  return score >= 8; // Higher threshold to prevent distant date range matches
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
    
    // Prepare result structure
    const result: ComparisonResult = {
      missingInDb: [],
      missingInSheet: [],
      matched: [],
      mismatched: []
    };
    
    // Validate data before processing - only include lessons with sufficient data
    // LESS STRICT VALIDATION - only require student name
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
    
    // Track which lessons have been processed to avoid duplication
    const processedDbKeys = new Set<string>();
    const processedSheetIndices = new Set<number>();
    
    // First, calculate best potential scores for each database lesson to determine processing order
    const dbLessonsWithScores = validDbLessons.map(dbLesson => {
      let bestPotentialScore = 0;
      
      for (let sheetIndex = 0; sheetIndex < validSheetLessons.length; sheetIndex++) {
        const sheetLesson = validSheetLessons[sheetIndex];
        
        if (isSameLesson(dbLesson, sheetLesson)) {
          const score = calculateMatchScore(dbLesson, sheetLesson);
          if (score > bestPotentialScore) {
            bestPotentialScore = score;
          }
        }
      }
      
      return { dbLesson, bestPotentialScore };
    });
    
    // Sort by best potential score (highest first) to give priority to better matches
    dbLessonsWithScores.sort((a, b) => b.bestPotentialScore - a.bestPotentialScore);
    
    console.log('Processing database lessons in score order:', 
      dbLessonsWithScores.map(item => `${item.dbLesson.studentName}: ${item.bestPotentialScore}`));
    
    // Process database lessons in score order (best matches first)
    dbLessonsWithScores.forEach(({ dbLesson }) => {
      let bestMatch: { sheetLesson: SheetLesson; sheetIndex: number; score: number } | null = null;
      const allPotentialMatches: { sheetLesson: SheetLesson; sheetIndex: number; score: number }[] = [];
      
      // Find all potential matches and their scores
      for (let sheetIndex = 0; sheetIndex < validSheetLessons.length; sheetIndex++) {
        const sheetLesson = validSheetLessons[sheetIndex];
        
        // Skip if this sheet lesson is already processed
        if (processedSheetIndices.has(sheetIndex)) {
          continue;
        }
        
        if (isSameLesson(dbLesson, sheetLesson)) {
          const score = calculateMatchScore(dbLesson, sheetLesson);
          allPotentialMatches.push({ sheetLesson, sheetIndex, score });
          
          // Keep track of the best match (highest score)
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { sheetLesson, sheetIndex, score };
          }
        }
      }
      
      // NEW: Log when multiple potential matches exist for debugging
      if (allPotentialMatches.length > 1) {
        console.warn(`⚠️  Multiple potential matches found for ${dbLesson.studentName}:`, 
          allPotentialMatches.map(m => `Score: ${m.score.toFixed(1)}, Teacher: ${m.sheetLesson.teacher}, Date: ${m.sheetLesson.startDate}`));
        console.warn(`   Selected best match with score: ${bestMatch?.score.toFixed(1)}`);
      }
      
      // If we found a match, process the best one
      if (bestMatch) {
        const { sheetLesson, sheetIndex } = bestMatch;
        
        // Check for differences in details (like teacher, dates, etc.)
        const differences = findDifferences(dbLesson, sheetLesson);
        
        if (differences.length === 0) {
          // Perfect match
          result.matched.push({ dbLesson, sheetLesson });
        } else {
          // Match on core fields but differences in other fields
          result.mismatched.push({ dbLesson, sheetLesson, differences });
        }
        
        // Mark as processed
        processedDbKeys.add(dbLesson.id);
        processedSheetIndices.add(sheetIndex);
        
        console.log(`✅ Matched ${dbLesson.studentName} with score ${bestMatch.score.toFixed(1)} (teacher: ${sheetLesson.teacher}, date range: ${formatDateRange(dbLesson.startDate, dbLesson.endDate)})`);
      }
    });
    
    console.log(`Found ${result.matched.length} exact matches and ${result.mismatched.length} mismatches`);

    // Now look for sheet lessons that might partially match unprocessed db lessons
    validSheetLessons.forEach((sheetLesson, sheetIndex) => {
      // Skip already processed
      if (processedSheetIndices.has(sheetIndex)) {
        return;
      }
      
      // Look for partial matches
      let foundPartialMatch = false;
      
      for (const dbLesson of validDbLessons) {
        // Skip already processed
        if (processedDbKeys.has(dbLesson.id)) {
          continue;
        }
        
        // Check for partial match
        if (isPartialMatch(dbLesson, sheetLesson)) {
          const differences = findDifferences(dbLesson, sheetLesson);
          result.mismatched.push({ dbLesson, sheetLesson, differences });
          
          // Mark as processed
          processedDbKeys.add(dbLesson.id);
          processedSheetIndices.add(sheetIndex);
          
          foundPartialMatch = true;
          break;
        }
      }
      
      // If no match at all, it's missing from DB
      if (!foundPartialMatch) {
        result.missingInDb.push(sheetLesson);
      }
    });
    
    // Any remaining DB lessons are missing from sheet
    validDbLessons.forEach(dbLesson => {
      if (!processedDbKeys.has(dbLesson.id)) {
        result.missingInSheet.push(dbLesson);
      }
    });
    
    console.log('Comparison summary:', {
      dbLessonsCount: validDbLessons.length,
      sheetLessonsCount: validSheetLessons.length,
      matched: result.matched.length,
      mismatched: result.mismatched.length,
      missingInDb: result.missingInDb.length, 
      missingInSheet: result.missingInSheet.length
    });
    
    return result;
  } catch (err) {
    console.error('Error comparing lessons:', err);
    throw err;
  }
}; 