import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Lesson, LessonUnsaved } from '../types';
import { useSchool } from './SchoolContext';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, subMonths, addMonths } from 'date-fns';

interface LessonsContextType {
  lessons: Lesson[];
  currentWeek: Date;
  fetchLessons: (forTeacherId?: string | null, targetDate?: Date, returnOnly?: boolean) => Promise<Lesson[]>;
  createLesson: (lessonData: LessonUnsaved, currentlySelectedTeacherId?: string) => Promise<Lesson | null>;
  assignLesson: (lessonId: string, teacherId: string, dayOfWeek: number, startTime: string, slotDate: Date) => Promise<Lesson | null>;
  rescheduleLesson: (originalLessonId: string, originalSlotDate: Date, targetTeacherId: string | null, targetDayOfWeek: number, targetStartTime: string, targetSlotDate: Date) => Promise<Lesson | null>;
  unassignLesson: (originalLessonId: string, unassignDate: Date) => Promise<Lesson | null>;
  deleteLesson: (originalLessonId: string, trashDate: Date) => Promise<void>;
  updateLesson: (lessonData: Partial<Lesson> & { id: string }) => Promise<Lesson | null>;
  nextWeek: () => void;
  prevWeek: () => void;
  setCurrentWeek: (date: Date) => void;
  getWeekDates: () => Date[];
  loading: boolean;
  error: Error | null;
}

const LessonsContext = createContext<LessonsContextType | undefined>(undefined);

const LessonsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { currentSchool, userRole, isSchoolAdmin } = useSchool();

  const fetchLessons = useCallback(async (forTeacherId?: string | null, targetDate?: Date, returnOnly?: boolean) => {
    if (!currentSchool) {
      if (!returnOnly) setLessons([]);
      return [];
    }

    setLoading(true);
    setError(null);
    const dateToQuery = targetDate || currentWeek;
    
    // Convert dateToQuery to start and end of the week for proper filtering
    const weekStart = format(startOfWeek(dateToQuery, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(dateToQuery, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    
    // Use a wider window for data fetching (to ensure recurring lessons are included)
    const viewWindowStart = format(startOfWeek(subMonths(dateToQuery, 2), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const viewWindowEnd = format(endOfWeek(addMonths(dateToQuery, 2), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    try {
      let query = supabase.from('lessons').select('*').eq('school_id', currentSchool.id);
      
      // Handle teacher vs admin permissions and filtering
      if (!isSchoolAdmin && userRole === 'teacher') {
        // Teachers can only see their own lessons in this school
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq('teacher_id', user.id);
        }
      } else if (isSchoolAdmin) {
        // School admins have different filtering based on the request
        if (typeof forTeacherId === 'string') {
          // Admin wants to see a specific teacher's lessons + unassigned
          query = query.or(`teacher_id.eq.${forTeacherId},teacher_id.is.null`);
        } else if (forTeacherId === null) {
          // Admin wants to see only unassigned lessons
          query = query.is('teacher_id', null);
        } else {
          // No specific teacher requested (default case)
          // Just fetch unassigned lessons as a starting point
          query = query.is('teacher_id', null);
        }
      } else {
        // No valid role, return empty array
        if (!returnOnly) {
          setLessons([]);
        }
        setLoading(false);
        return [];
      }
      
      // Date filtering - this makes sure we only get lessons relevant to the current view
      query = query.or(`start_date.lte.${viewWindowEnd},start_date.is.null`);
      query = query.or(`end_date.gte.${viewWindowStart},end_date.is.null`);
      
      query = query.order('start_date', { ascending: true, nullsFirst: true })
                   .order('start_time', { ascending: true });

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      // Map DB fields to our front-end format
      const mappedLessons = data?.map(lesson => ({
        id: lesson.id,
        school_id: lesson.school_id,
        student_name: lesson.student_name,
        duration: lesson.duration_minutes,
        teacher_id: lesson.teacher_id,
        day: lesson.day_of_week,
        start_time: lesson.start_time,
        subject_id: lesson.subject_id,
        start_date: lesson.start_date,
        end_date: lesson.end_date,
        created_at: lesson.created_at,
        updated_at: lesson.updated_at
      })) || [];
      
      console.log('Fetched lessons with school filtering:', 
                 `Count: ${mappedLessons.length},`, 
                 `forTeacherId: ${forTeacherId},`,
                 `School: ${currentSchool.name}`,
                 `Week: ${weekStart} to ${weekEnd}`,
                 returnOnly ? '(return only)' : '');
      
      // If returnOnly is true, just return the mapped lessons without setting state
      if (returnOnly) {
        setLoading(false);
        return mappedLessons;
      }
      
      // Only set lessons if there's meaningful data to set or we actually want to clear it
      if (mappedLessons.length > 0 || forTeacherId !== undefined) {
        setLessons(mappedLessons);
      }
      
      setLoading(false);
      return mappedLessons;
    } catch (e) {
      setError(e as Error);
      console.error("Error fetching lessons:", e);
      if (!returnOnly) {
        setLessons([]);
      }
      setLoading(false);
      return [];
    }
  }, [currentWeek, currentSchool, isSchoolAdmin, userRole]);

  useEffect(() => {
    // This effect handles initial load and changes to school context or currentWeek
    if (!currentSchool) {
      setLessons([]);
      return;
    }
    
    if (!isSchoolAdmin && userRole === 'teacher') { 
      // Teachers only fetch their own lessons
      fetchLessons(undefined, currentWeek); 
    }
    // For school admins, we don't fetch anything here by default
    // Schedule.tsx will trigger its own fetch with the selected teacher
  }, [currentSchool, userRole, isSchoolAdmin, currentWeek, fetchLessons]);

  const createLesson = async (lessonData: LessonUnsaved, currentlySelectedTeacherId?: string): Promise<Lesson | null> => {
    if (!isSchoolAdmin || !currentSchool) { 
      setError(new Error("School admin access required")); 
      return null; 
    }
    
    setLoading(true); 
    setError(null);
    
    try {
      const { data, error: insertError } = await supabase
        .from('lessons')
        .insert({
          school_id: currentSchool.id,
          student_name: lessonData.student_name,
          duration_minutes: lessonData.duration,
          subject_id: lessonData.subject_id,
          teacher_id: lessonData.teacher_id,
          day_of_week: lessonData.day,
          start_time: lessonData.start_time,
          start_date: lessonData.start_date,
          end_date: lessonData.end_date
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newLesson: Lesson = {
        id: data.id,
        school_id: data.school_id,
        student_name: data.student_name,
        duration: data.duration_minutes,
        teacher_id: data.teacher_id,
        day: data.day_of_week,
        start_time: data.start_time,
        subject_id: data.subject_id,
        start_date: data.start_date,
        end_date: data.end_date,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      
      console.log('Created new lesson:', newLesson);
      
      // Refresh lessons based on current selection
      if (currentlySelectedTeacherId) {
        await fetchLessons(currentlySelectedTeacherId, currentWeek);
      } else {
        await fetchLessons(null, currentWeek);
      }
      
      setLoading(false);
      return newLesson;
    } catch (e) { 
      setError(e as Error); 
      setLoading(false); 
      return null; 
    }
  };

  const assignLesson = async (lessonId: string, teacherId: string, dayOfWeek: number, startTime: string, slotDate: Date): Promise<Lesson | null> => {
    if (!isSchoolAdmin || !currentSchool) { 
      setError(new Error("School admin access required")); 
      return null; 
    }
    
    setLoading(true); 
    setError(null);
    
    try {
      // Use the database function that properly handles start and end dates
      const { data, error: rpcError } = await supabase
        .rpc('handle_lesson_assign', {
          p_lesson_id: lessonId,
          p_teacher_id: teacherId,
          p_day_of_week: dayOfWeek,
          p_start_time: startTime,
          p_slot_date: format(slotDate, 'yyyy-MM-dd')
        });

      if (rpcError) throw rpcError;

      const updatedLesson: Lesson = {
        id: data[0].id,
        school_id: data[0].school_id,
        student_name: data[0].student_name,
        duration: data[0].duration_minutes,
        teacher_id: data[0].teacher_id,
        day: data[0].day_of_week,
        start_time: data[0].start_time,
        subject_id: data[0].subject_id,
        start_date: data[0].start_date,
        end_date: data[0].end_date,
        created_at: data[0].created_at,
        updated_at: data[0].updated_at
      };

      // Update local state
      setLessons(prev => prev.map(lesson => 
        lesson.id === lessonId ? updatedLesson : lesson
      ));

      setLoading(false);
      return updatedLesson;
    } catch (e) { 
      setError(e as Error); 
      setLoading(false); 
      return null; 
    }
  };

  const rescheduleLesson = async (originalLessonId: string, originalSlotDate: Date, targetTeacherId: string | null, targetDayOfWeek: number, targetStartTime: string, targetSlotDate: Date): Promise<Lesson | null> => {
    if (!isSchoolAdmin || !currentSchool) { 
      setError(new Error("School admin access required")); 
      return null; 
    }
    
    setLoading(true); 
    setError(null);
    
    // Get the original lesson that we're rescheduling
    const originalLesson = lessons.find(l => l.id === originalLessonId);
    if (!originalLesson) {
      console.error("Cannot reschedule: Original lesson not found", originalLessonId);
      setLoading(false);
      return null;
    }
    
    // If targetTeacherId is undefined/null, use the original lesson's teacher
    const effectiveTeacherId = targetTeacherId || originalLesson.teacher_id;

    try {
      // Use the database function that properly handles lesson moving with dates
      const { data, error: rpcError } = await supabase
        .rpc('handle_lesson_move', {
          p_original_lesson_id: originalLessonId,
          p_original_slot_date: format(originalSlotDate, 'yyyy-MM-dd'),
          p_target_teacher_id: effectiveTeacherId,
          p_target_day_of_week: targetDayOfWeek,
          p_target_start_time: targetStartTime,
          p_target_slot_date: format(targetSlotDate, 'yyyy-MM-dd')
        });

      if (rpcError) throw rpcError;

      const newLesson: Lesson = {
        id: data[0].id,
        school_id: data[0].school_id,
        student_name: data[0].student_name,
        duration: data[0].duration_minutes,
        teacher_id: data[0].teacher_id,
        day: data[0].day_of_week,
        start_time: data[0].start_time,
        subject_id: data[0].subject_id,
        start_date: data[0].start_date,
        end_date: data[0].end_date,
        created_at: data[0].created_at,
        updated_at: data[0].updated_at
      };
      
      // Remove the old lesson and add the new one
      setLessons(prev => [
        ...prev.filter(lesson => lesson.id !== originalLessonId),
        newLesson
      ]);
      
      setLoading(false);
      return newLesson;
    } catch (e) { 
      console.error("Error in rescheduleLesson:", e);
      setError(e as Error); 
      setLoading(false); 
      return null; 
    }
  };

  const unassignLesson = async (originalLessonId: string, unassignDate: Date): Promise<Lesson | null> => {
    if (!isSchoolAdmin || !currentSchool) { 
      setError(new Error("School admin access required")); 
      return null; 
    }
    
    setLoading(true); 
    setError(null);
    
    try {
      // Use the database function that properly handles lesson unassignment with dates
      const { data, error: rpcError } = await supabase
        .rpc('handle_lesson_unassign', {
          p_original_lesson_id: originalLessonId,
          p_unassign_date: format(unassignDate, 'yyyy-MM-dd')
        });

      if (rpcError) throw rpcError;

      const newUnassignedLesson: Lesson = {
        id: data[0].id,
        school_id: data[0].school_id,
        student_name: data[0].student_name,
        duration: data[0].duration_minutes,
        teacher_id: data[0].teacher_id,
        day: data[0].day_of_week,
        start_time: data[0].start_time,
        subject_id: data[0].subject_id,
        start_date: data[0].start_date,
        end_date: data[0].end_date,
        created_at: data[0].created_at,
        updated_at: data[0].updated_at
      };

      // Remove the old lesson and add the new unassigned one
      setLessons(prev => [
        ...prev.filter(lesson => lesson.id !== originalLessonId),
        newUnassignedLesson
      ]);

      setLoading(false);
      return newUnassignedLesson;
    } catch (e) { 
      setError(e as Error); 
      setLoading(false); 
      return null; 
    }
  };

  const deleteLesson = async (originalLessonId: string, trashDate: Date): Promise<void> => {
    if (!isSchoolAdmin || !currentSchool) { 
      setError(new Error("School admin access required")); 
      return; 
    }
    
    setLoading(true); 
    setError(null);
    
    try {
      // Use the database function that properly handles lesson deletion with dates
      const { data, error: rpcError } = await supabase
        .rpc('handle_lesson_trash', {
          p_original_lesson_id: originalLessonId,
          p_trash_date: format(trashDate, 'yyyy-MM-dd')
        });
      
      if (rpcError) {
        throw rpcError;
      }
      
      // Update local state - remove the lesson
      setLessons(prev => prev.filter(lesson => lesson.id !== originalLessonId));
      
      setLoading(false);
    } catch (e) { 
      setError(e as Error); 
      setLoading(false); 
    }
  };

  const updateLesson = async (lessonData: Partial<Lesson> & { id: string }): Promise<Lesson | null> => {
    if (!isSchoolAdmin) { setError(new Error("School admin access required")); return null; }
    setLoading(true); setError(null);
    try {
      // Format dates for the database
      const formattedData: Record<string, any> = {
        student_name: lessonData.student_name,
        duration_minutes: lessonData.duration,
        teacher_id: lessonData.teacher_id || null,
        day_of_week: lessonData.day !== undefined ? lessonData.day : null,
        start_time: lessonData.start_time || null,
        subject_id: lessonData.subject_id
      };
      
      // Only include start_date and end_date if they're provided
      if (lessonData.start_date) {
        formattedData.start_date = lessonData.start_date;
      }
      if (lessonData.end_date) {
        formattedData.end_date = lessonData.end_date;
      }
      
      const { data, error: updateError } = await supabase
        .from('lessons')
        .update(formattedData)
        .eq('id', lessonData.id)
        .eq('school_id', currentSchool.id)
        .select();
        
      if (updateError) throw updateError;
      
      // Map the response to our frontend format
      const updatedLesson = data?.[0] ? {
        id: data[0].id,
        school_id: data[0].school_id,
        student_name: data[0].student_name,
        duration: data[0].duration_minutes,
        teacher_id: data[0].teacher_id,
        day: data[0].day_of_week,
        start_time: data[0].start_time,
        subject_id: data[0].subject_id,
        start_date: data[0].start_date,
        end_date: data[0].end_date,
        created_at: data[0].created_at,
        updated_at: data[0].updated_at
      } : null;
      
      // Refresh lessons for the current view
      if (updatedLesson) {
        // If the lesson is assigned to a teacher, fetch lessons for that teacher
        if (updatedLesson.teacher_id) {
          await fetchLessons(updatedLesson.teacher_id, currentWeek);
        } else {
          // Otherwise, fetch all unassigned lessons
          await fetchLessons(null, currentWeek);
        }
      }
      
      setLoading(false);
      return updatedLesson;
    } catch (e) { 
      console.error("Error updating lesson:", e);
      setError(e as Error); 
      setLoading(false); 
      return null; 
    }
  };

  const getWeekDates = () => {
    const mondayOfWeek = startOfWeek(currentWeek, { weekStartsOn: 1 });
    return [0, 1, 2, 3, 4].map(day => addDays(mondayOfWeek, day));
  };
  const nextWeek = () => setCurrentWeek(prev => addWeeks(prev, 1));
  const prevWeek = () => setCurrentWeek(prev => subWeeks(prev, 1));
  const setWeek = (date: Date) => setCurrentWeek(startOfWeek(date, { weekStartsOn: 1 }));

  return (
    <LessonsContext.Provider value={{ 
      lessons, 
      currentWeek,
      fetchLessons,
      createLesson,
      assignLesson,
      rescheduleLesson,
      unassignLesson,
      deleteLesson,
      updateLesson,
      nextWeek,
      prevWeek,
      setCurrentWeek: setWeek,
      getWeekDates,
      loading,
      error
    }}>
      {children}
    </LessonsContext.Provider>
  );
};

export const useLessons = () => {
  const context = useContext(LessonsContext);
  if (context === undefined) {
    throw new Error('useLessons must be used within a LessonsProvider');
  }
  return context;
};

export default LessonsProvider;
