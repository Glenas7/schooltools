-- Triggers and Functions for Multi-tenant School Scheduler

-- Function to handle user creation from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to handle school creation (assign creator as admin)
CREATE OR REPLACE FUNCTION public.handle_school_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the creator as an admin of the new school
  INSERT INTO public.user_schools (user_id, school_id, role, active)
  VALUES (auth.uid(), NEW.id, 'admin', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for school creation
DROP TRIGGER IF EXISTS on_school_created ON public.schools;
CREATE TRIGGER on_school_created
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.handle_school_created();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers for all tables
DROP TRIGGER IF EXISTS update_schools_updated_at ON public.schools;
CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subjects_updated_at ON public.subjects;
CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON public.lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lesson management functions (adapted for multi-tenancy)

-- Function to create a new lesson
CREATE OR REPLACE FUNCTION public.create_new_lesson_from_form(
  p_school_id UUID,
  p_student_name TEXT,
  p_duration_minutes INTEGER,
  p_subject_id UUID,
  p_teacher_id UUID DEFAULT NULL,
  p_day_of_week INTEGER DEFAULT NULL,
  p_start_time TIME DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  school_id UUID,
  student_name TEXT,
  duration_minutes INTEGER,
  teacher_id UUID,
  day_of_week INTEGER,
  start_time TIME,
  subject_id UUID,
  start_date DATE,
  end_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_lesson_id UUID;
BEGIN
  -- Check if user has admin access to the school
  IF NOT public.get_user_school_role(p_school_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  INSERT INTO public.lessons (
    school_id,
    student_name,
    duration_minutes,
    teacher_id,
    day_of_week,
    start_time,
    subject_id,
    start_date,
    end_date
  ) VALUES (
    p_school_id,
    p_student_name,
    p_duration_minutes,
    p_teacher_id,
    p_day_of_week,
    p_start_time,
    p_subject_id,
    p_start_date,
    p_end_date
  ) RETURNING lessons.id INTO new_lesson_id;

  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.student_name,
    l.duration_minutes,
    l.teacher_id,
    l.day_of_week,
    l.start_time,
    l.subject_id,
    l.start_date,
    l.end_date
  FROM public.lessons l
  WHERE l.id = new_lesson_id;
END;
$$;

-- Function to handle lesson assignment
CREATE OR REPLACE FUNCTION public.handle_lesson_assign(
  p_lesson_id UUID,
  p_teacher_id UUID,
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_slot_date DATE
)
RETURNS TABLE(
  id UUID,
  school_id UUID,
  student_name TEXT,
  duration_minutes INTEGER,
  teacher_id UUID,
  day_of_week INTEGER,
  start_time TIME,
  subject_id UUID,
  start_date DATE,
  end_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lesson_school_id UUID;
BEGIN
  -- Get the school_id from the lesson
  SELECT l.school_id INTO lesson_school_id 
  FROM public.lessons l 
  WHERE l.id = p_lesson_id;

  -- Check if user has admin access to the school
  IF NOT public.get_user_school_role(lesson_school_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  UPDATE public.lessons 
  SET 
    teacher_id = p_teacher_id,
    day_of_week = p_day_of_week,
    start_time = p_start_time,
    start_date = p_slot_date,
    end_date = NULL
  WHERE id = p_lesson_id;

  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.student_name,
    l.duration_minutes,
    l.teacher_id,
    l.day_of_week,
    l.start_time,
    l.subject_id,
    l.start_date,
    l.end_date
  FROM public.lessons l
  WHERE l.id = p_lesson_id;
END;
$$;

-- Function to handle lesson move (reschedule)
CREATE OR REPLACE FUNCTION public.handle_lesson_move(
  p_original_lesson_id UUID,
  p_original_slot_date DATE,
  p_target_teacher_id UUID,
  p_target_day_of_week INTEGER,
  p_target_start_time TIME,
  p_target_slot_date DATE
)
RETURNS TABLE(
  id UUID,
  school_id UUID,
  student_name TEXT,
  duration_minutes INTEGER,
  teacher_id UUID,
  day_of_week INTEGER,
  start_time TIME,
  subject_id UUID,
  start_date DATE,
  end_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  original_lesson public.lessons%ROWTYPE;
  new_lesson_id UUID;
BEGIN
  -- Get the original lesson
  SELECT * INTO original_lesson 
  FROM public.lessons 
  WHERE id = p_original_lesson_id;

  -- Check if user has admin access to the school
  IF NOT public.get_user_school_role(original_lesson.school_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Handle the original lesson
  IF original_lesson.start_date = p_original_slot_date THEN
    DELETE FROM public.lessons WHERE id = p_original_lesson_id;
  ELSE
    UPDATE public.lessons 
    SET end_date = p_original_slot_date 
    WHERE id = p_original_lesson_id;
  END IF;

  -- Create new lesson in target slot
  INSERT INTO public.lessons (
    school_id,
    student_name,
    duration_minutes,
    teacher_id,
    day_of_week,
    start_time,
    subject_id,
    start_date,
    end_date
  ) VALUES (
    original_lesson.school_id,
    original_lesson.student_name,
    original_lesson.duration_minutes,
    p_target_teacher_id,
    p_target_day_of_week,
    p_target_start_time,
    original_lesson.subject_id,
    p_target_slot_date,
    NULL
  ) RETURNING id INTO new_lesson_id;

  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.student_name,
    l.duration_minutes,
    l.teacher_id,
    l.day_of_week,
    l.start_time,
    l.subject_id,
    l.start_date,
    l.end_date
  FROM public.lessons l
  WHERE l.id = new_lesson_id;
END;
$$;

-- Function to handle lesson unassign
CREATE OR REPLACE FUNCTION public.handle_lesson_unassign(
  p_original_lesson_id UUID,
  p_unassign_date DATE
)
RETURNS TABLE(
  id UUID,
  school_id UUID,
  student_name TEXT,
  duration_minutes INTEGER,
  teacher_id UUID,
  day_of_week INTEGER,
  start_time TIME,
  subject_id UUID,
  start_date DATE,
  end_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  original_lesson public.lessons%ROWTYPE;
  new_lesson_id UUID;
BEGIN
  -- Get the original lesson
  SELECT * INTO original_lesson 
  FROM public.lessons 
  WHERE id = p_original_lesson_id;

  -- Check if user has admin access to the school
  IF NOT public.get_user_school_role(original_lesson.school_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Handle the original lesson
  IF original_lesson.start_date = p_unassign_date THEN
    DELETE FROM public.lessons WHERE id = p_original_lesson_id;
  ELSE
    UPDATE public.lessons 
    SET end_date = p_unassign_date 
    WHERE id = p_original_lesson_id;
  END IF;

  -- Create new unassigned lesson
  INSERT INTO public.lessons (
    school_id,
    student_name,
    duration_minutes,
    teacher_id,
    day_of_week,
    start_time,
    subject_id,
    start_date,
    end_date
  ) VALUES (
    original_lesson.school_id,
    original_lesson.student_name,
    original_lesson.duration_minutes,
    NULL,
    NULL,
    NULL,
    original_lesson.subject_id,
    p_unassign_date,
    NULL
  ) RETURNING id INTO new_lesson_id;

  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.student_name,
    l.duration_minutes,
    l.teacher_id,
    l.day_of_week,
    l.start_time,
    l.subject_id,
    l.start_date,
    l.end_date
  FROM public.lessons l
  WHERE l.id = new_lesson_id;
END;
$$;

-- Function to handle lesson deletion (trash)
CREATE OR REPLACE FUNCTION public.handle_lesson_trash(
  p_original_lesson_id UUID,
  p_trash_date DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  original_lesson public.lessons%ROWTYPE;
BEGIN
  -- Get the original lesson
  SELECT * INTO original_lesson 
  FROM public.lessons 
  WHERE id = p_original_lesson_id;

  -- Check if user has admin access to the school
  IF NOT public.get_user_school_role(original_lesson.school_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Handle the original lesson
  IF original_lesson.start_date = p_trash_date THEN
    DELETE FROM public.lessons WHERE id = p_original_lesson_id;
  ELSE
    UPDATE public.lessons 
    SET end_date = p_trash_date 
    WHERE id = p_original_lesson_id;
  END IF;

  RETURN TRUE;
END;
$$; 