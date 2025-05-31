import { supabase } from './supabaseClient';
import { Lesson } from '../types';
import { format, parseISO, addMinutes } from 'date-fns';

// Define types for lesson data
export type SheetLesson = {
  studentName: string;
  duration: number;
  teacher: string;
  startDate: string;
  instrument: string;
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
  instrumentId: string;
  instrumentName: string;
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
export const wouldCauseConflict = async (dbLesson: DbLesson, sheetLesson: SheetLesson): Promise<{
  hasConflict: boolean;
  conflictMessage: string | null;
}> => {
  try {
    // First, find the teacher ID for the sheet lesson's teacher name
    const { data: teachersData, error: teachersError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'teacher')
      .ilike('name', sheetLesson.teacher)
      .limit(1);
    
    if (teachersError) {
      console.error('Error finding teacher:', teachersError);
      return { hasConflict: true, conflictMessage: 'Error finding teacher: ' + teachersError.message };
    }
    
    if (!teachersData || teachersData.length === 0) {
      return { 
        hasConflict: true, 
        conflictMessage: `Teacher "${sheetLesson.teacher}" from Google Sheet not found in database.`
      };
    }
    
    const targetTeacherId = teachersData[0].id;
    
    // Find the instrument ID for the sheet lesson's instrument name
    const { data: instrumentsData, error: instrumentsError } = await supabase
      .from('instruments')
      .select('id, name')
      .ilike('name', sheetLesson.instrument)
      .limit(1);
    
    if (instrumentsError) {
      console.error('Error finding instrument:', instrumentsError);
      return { hasConflict: true, conflictMessage: 'Error finding instrument: ' + instrumentsError.message };
    }
    
    if (!instrumentsData || instrumentsData.length === 0) {
      return { 
        hasConflict: true, 
        conflictMessage: `Instrument "${sheetLesson.instrument}" from Google Sheet not found in database.`
      };
    }
    
    const targetInstrumentId = instrumentsData[0].id;
    
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
export const alignLessonWithSheet = async (dbLesson: DbLesson, sheetLesson: SheetLesson): Promise<{
  success: boolean;
  message: string;
  updatedLesson?: DbLesson;
}> => {
  try {
    // Find the teacher ID based on the teacher name from Google Sheets
    const { data: teachersData, error: teachersError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'teacher')
      .ilike('name', sheetLesson.teacher)
      .limit(1);
    
    if (teachersError) throw new Error('Error finding teacher: ' + teachersError.message);
    if (!teachersData || teachersData.length === 0) {
      throw new Error(`Teacher "${sheetLesson.teacher}" not found in database.`);
    }
    
    const targetTeacherId = teachersData[0].id;
    
    // Find the instrument ID based on the instrument name from Google Sheets
    const { data: instrumentsData, error: instrumentsError } = await supabase
      .from('instruments')
      .select('id, name')
      .ilike('name', sheetLesson.instrument)
      .limit(1);
    
    if (instrumentsError) throw new Error('Error finding instrument: ' + instrumentsError.message);
    if (!instrumentsData || instrumentsData.length === 0) {
      throw new Error(`Instrument "${sheetLesson.instrument}" not found in database.`);
    }
    
    const targetInstrumentId = instrumentsData[0].id;
    
    // Create the update data
    const updateData = {
      student_name: sheetLesson.studentName,
      duration_minutes: sheetLesson.duration,
      teacher_id: targetTeacherId,
      instrument_id: targetInstrumentId,
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
        instrument_id, 
        instruments:instrument_id (name, color), 
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
      instrument_id: string;
      instruments: { name: string; color: string } | null;
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
      instrumentId: typedData.instrument_id,
      instrumentName: typedData.instruments ? typedData.instruments.name : 'Unknown Instrument',
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
        instrument: row.instrument || '',
        row: index + 2 // +2 because index 0 is row 2 (after header row)
      };
      
      // Validate lesson data
      if (!lesson.studentName) {
        console.warn(`Missing student name in sheet lesson at row ${index + 2}`);
      }
      if (!lesson.instrument) {
        console.warn(`Missing instrument in sheet lesson for ${lesson.studentName || 'unnamed student'}`);
      }
      
      return lesson;
    });
  } catch (err) {
    console.error('Error fetching Google Sheet lessons:', err);
    throw err;
  }
};

// Function to fetch lessons from the database
export const fetchDatabaseLessons = async (): Promise<DbLesson[]> => {
  try {
    console.log('Fetching lessons from database...');
    // Get all lessons from the database
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('*');
    
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

    // Get all instruments
    console.log('Fetching instruments from database...');
    const { data: instruments, error: instrumentsError } = await supabase
      .from('instruments')
      .select('id, name');
    
    if (instrumentsError) {
      console.error('Error fetching instruments:', instrumentsError);
      throw new Error(`Failed to fetch instruments from database: ${instrumentsError.message}`);
    }

    console.log(`Retrieved ${instruments?.length || 0} instruments from database`);
    console.log('All instruments:', instruments);

    // Get all teachers
    console.log('Fetching teachers from database...');
    const { data: teachers, error: teachersError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'teacher');
    
    if (teachersError) {
      console.error('Error fetching teachers:', teachersError);
      throw new Error(`Failed to fetch teachers from database: ${teachersError.message}`);
    }

    console.log(`Retrieved ${teachers?.length || 0} teachers from database`);
    console.log('All teachers:', teachers);

    // Log data for debugging
    console.log(`Raw DB Data: ${lessonsData.length} lessons, ${instruments.length} instruments, ${teachers.length} teachers`);
    
    // Create lookup maps for instruments and teachers
    const instrumentMap = new Map(instruments.map(i => [i.id, i.name]));
    const teacherMap = new Map(teachers.map(t => [t.id, t.name]));
    
    console.log('Instrument map has', instrumentMap.size, 'entries');
    console.log('Teacher map has', teacherMap.size, 'entries');
    
    // Map instrument IDs to names
    console.log('First few instrument map entries:', Array.from(instrumentMap.entries()).slice(0, 3));
    
    // Transform the data to match our expected format
    const mappedLessons = lessonsData.map((lesson: any) => {
      // Extract student name from appropriate field
      const studentName = lesson.studentName || lesson.student_name || 'Unnamed Student';
      
      // Log instrument details to debug mapping
      const instrumentId = lesson.instrumentId || lesson.instrument_id;
      console.log(`Instrument ID for lesson ${lesson.id}:`, instrumentId);
      
      // Get instrument name from map - extra logging for Liam
      const instrumentName = instrumentId && instrumentMap.has(instrumentId) 
        ? instrumentMap.get(instrumentId) 
        : 'Unknown Instrument';
        
      if (studentName.includes('Liam')) {
        console.log(`Instrument lookup for Liam's lesson:`, {
          lessonId: lesson.id,
          instrumentId,
          foundInMap: instrumentId ? instrumentMap.has(instrumentId) : false,
          mapResult: instrumentId ? instrumentMap.get(instrumentId) : null
        });
      }
      
      // Get teacher ID from appropriate field
      const teacherId = lesson.teacherId || lesson.teacher_id;
      
      // Get teacher name from map
      const teacherName = teacherId && teacherMap.has(teacherId)
        ? teacherMap.get(teacherId)
        : null;
      
      // Specifically log Liam-related lessons
      if (studentName.includes('Liam')) {
        console.log('Found Liam lesson in DB mapping step:', { 
          id: lesson.id, 
          studentName,
          instrumentId,
          instrumentName,
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
        instrumentId: instrumentId || '',
        instrumentName: instrumentName,
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
        instrumentName: dbLesson?.instrumentName,
        teacherName: dbLesson?.teacherName,
        startDate: dbLesson?.startDate
      }, 
      sheetLesson: {
        studentName: sheetLesson?.studentName,
        duration: sheetLesson?.duration,
        instrument: sheetLesson?.instrument,
        teacher: sheetLesson?.teacher,
        startDate: sheetLesson?.startDate
      }
    });
  }
  
  // Check for null or undefined values first
  if (!dbLesson?.studentName || !sheetLesson?.studentName || 
      dbLesson.duration === undefined || sheetLesson.duration === undefined ||
      !dbLesson?.instrumentName || !sheetLesson?.instrument) {
    console.log('Missing required properties for comparison, returning false');
    return false;
  }
  
  // Basic match on student name, duration and instrument (with more flexible matching)
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
  const instrumentMatch = 
    dbLesson.instrumentName.toLowerCase() === sheetLesson.instrument.toLowerCase();
  
  // We consider it a full match if all three criteria match
  const isMatch = studentNameMatch && durationMatch && instrumentMatch;
  
  // For Liam lessons, log the result of each comparison
  if (dbStudentNormalized.includes('liam') || sheetStudentNormalized.includes('liam')) {
    console.log('Liam lesson match details:', {
      studentNameMatch,
      durationMatch,
      instrumentMatch,
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
  
  // Basic match on student name, duration and instrument
  const studentNameMatch = dbStudentNormalized === sheetStudentNormalized;
  const durationMatch = Number(dbLesson.duration) === Number(sheetLesson.duration);
  const instrumentMatch = 
    dbLesson.instrumentName && sheetLesson.instrument &&
    dbLesson.instrumentName.toLowerCase() === sheetLesson.instrument.toLowerCase();
  
  // Log for Liam Duque Sanz
  if (dbLesson.studentName.includes('Liam') || 
      sheetLesson.studentName.includes('Liam')) {
    console.log('Liam Duque Sanz partial match check:', {
      studentNameMatch,
      durationMatch, 
      instrumentMatch,
      dbName: dbLesson.studentName,
      sheetName: sheetLesson.studentName,
      dbNameNormalized: dbStudentNormalized,
      sheetNameNormalized: sheetStudentNormalized,
      dbDuration: dbLesson.duration,
      sheetDuration: sheetLesson.duration,
      dbInstrument: dbLesson.instrumentName,
      sheetInstrument: sheetLesson.instrument
    });
  }
  
  // Consider it a partial match if student name matches AND (duration or instrument matches)
  const isPartial = studentNameMatch && (durationMatch || instrumentMatch);
  
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
  
  if (dbLesson.instrumentName.toLowerCase() !== sheetLesson.instrument.toLowerCase()) {
    differences.push(`Instrument mismatch: "${dbLesson.instrumentName}" in DB vs "${sheetLesson.instrument}" in Sheet`);
  }
  
  // Compare teacher (handling null case)
  const dbTeacher = dbLesson.teacherName || 'Unassigned';
  if (dbTeacher.toLowerCase() !== sheetLesson.teacher.toLowerCase()) {
    differences.push(`Teacher mismatch: "${dbTeacher}" in DB vs "${sheetLesson.teacher}" in Sheet`);
  }
  
  // Compare start dates (handling null case)
  if (dbLesson.startDate !== sheetLesson.startDate) {
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
    const dbLessons = await fetchDatabaseLessons();
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
    
    // Search for Liam Duque Sanz lessons specifically for debugging
    const liamDbLessons = dbLessons.filter(lesson => 
      lesson && lesson.studentName && 
      (lesson.studentName.includes('Liam') || lesson.studentName.includes('Duque'))
    );
    const liamSheetLessons = sheetLessons.filter(lesson => 
      lesson && lesson.studentName && 
      (lesson.studentName.includes('Liam') || lesson.studentName.includes('Duque'))
    );
    
    console.log(`Found ${liamDbLessons.length} Liam lessons in DB and ${liamSheetLessons.length} in Sheet`);
    
    if (liamDbLessons.length > 0) {
      console.log('Liam DB lessons (complete details):', JSON.stringify(liamDbLessons, null, 2));
    }
    
    if (liamSheetLessons.length > 0) {
      console.log('Liam Sheet lessons (complete details):', JSON.stringify(liamSheetLessons, null, 2));
    }
    
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
    
    // First, find exact matches and mismatches
    validDbLessons.forEach((dbLesson) => {
      // Check each sheet lesson for matches
      validSheetLessons.forEach((sheetLesson, sheetIndex) => {
        if (isSameLesson(dbLesson, sheetLesson)) {
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
        }
      });
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