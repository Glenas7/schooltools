-- Migration: Add unique constraint ONLY for assigned lessons
-- This ensures data integrity and prevents the duplication issues we've been experiencing
-- Unassigned lessons are left completely unconstrained

-- For ASSIGNED lessons ONLY, create a unique index to prevent exact duplicates
-- This covers lessons where teacher_id, day_of_week, and start_time are NOT NULL
CREATE UNIQUE INDEX idx_lessons_unique_assigned
ON public.lessons (
  school_id,
  student_name,
  duration_minutes,
  teacher_id,
  day_of_week,
  start_time,
  subject_id,
  start_date
)
WHERE teacher_id IS NOT NULL 
  AND day_of_week IS NOT NULL 
  AND start_time IS NOT NULL 
  AND start_date IS NOT NULL;

-- Add a comment to document the purpose
COMMENT ON INDEX idx_lessons_unique_assigned IS 'Prevents duplicate assigned lessons with same school, student, duration, teacher, day, time, subject, and start date. Unassigned lessons are not constrained.';

-- Add a function to help identify potential duplicates for assigned lessons only
CREATE OR REPLACE FUNCTION public.find_duplicate_assigned_lessons()
RETURNS TABLE(
  duplicate_group TEXT,
  lesson_count BIGINT,
  sample_lesson_ids TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Find assigned lesson duplicates only
  SELECT 
    'assigned_' || school_id::text || '_' || student_name || '_' || duration_minutes::text || '_' || 
    teacher_id::text || '_' || day_of_week::text || '_' || start_time::text || '_' || 
    subject_id::text || '_' || start_date::text as duplicate_group,
    COUNT(*) as lesson_count,
    ARRAY_AGG(id::text) as sample_lesson_ids
  FROM public.lessons
  WHERE teacher_id IS NOT NULL 
    AND day_of_week IS NOT NULL 
    AND start_time IS NOT NULL 
    AND start_date IS NOT NULL
  GROUP BY school_id, student_name, duration_minutes, teacher_id, day_of_week, start_time, subject_id, start_date
  HAVING COUNT(*) > 1;
$$; 