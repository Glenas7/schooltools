-- Row Level Security Policies for Multi-tenant School Scheduler

-- Helper function to get user's schools with a specific role
CREATE OR REPLACE FUNCTION public.get_user_school_role(target_school_id UUID, target_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools us
    WHERE us.user_id = auth.uid()
    AND us.school_id = target_school_id
    AND us.role = target_role
    AND us.active = true
  );
$$;

-- Helper function to check if user has any access to a school
CREATE OR REPLACE FUNCTION public.has_school_access(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools us
    WHERE us.user_id = auth.uid()
    AND us.school_id = target_school_id
    AND us.active = true
  );
$$;

-- Helper function to get user's accessible school IDs
CREATE OR REPLACE FUNCTION public.get_user_school_ids()
RETURNS TABLE(school_id UUID)
LANGUAGE sql
STABLE
AS $$
  SELECT us.school_id
  FROM public.user_schools us
  WHERE us.user_id = auth.uid()
  AND us.active = true;
$$;

-- Schools table policies
CREATE POLICY "Users can view schools they belong to"
ON public.schools FOR SELECT
TO authenticated
USING (id IN (SELECT school_id FROM get_user_school_ids()));

CREATE POLICY "Authenticated users can create schools"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "School admins can update their schools"
ON public.schools FOR UPDATE
TO authenticated
USING (get_user_school_role(id, 'admin'))
WITH CHECK (get_user_school_role(id, 'admin'));

CREATE POLICY "School admins can delete their schools"
ON public.schools FOR DELETE
TO authenticated
USING (get_user_school_role(id, 'admin'));

-- Users table policies
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- User-Schools table policies
CREATE POLICY "Users can view their school memberships"
ON public.user_schools FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR get_user_school_role(school_id, 'admin'));

CREATE POLICY "School admins can manage user memberships"
ON public.user_schools FOR ALL
TO authenticated
USING (get_user_school_role(school_id, 'admin'))
WITH CHECK (get_user_school_role(school_id, 'admin'));

-- Subjects table policies
CREATE POLICY "School members can view subjects"
ON public.subjects FOR SELECT
TO authenticated
USING (has_school_access(school_id));

CREATE POLICY "School admins can manage subjects"
ON public.subjects FOR ALL
TO authenticated
USING (get_user_school_role(school_id, 'admin'))
WITH CHECK (get_user_school_role(school_id, 'admin'));

-- Teachers-Subjects table policies
CREATE POLICY "School members can view teacher-subject relationships"
ON public.teachers_subjects FOR SELECT
TO authenticated
USING (has_school_access(school_id));

CREATE POLICY "School admins can manage teacher-subject relationships"
ON public.teachers_subjects FOR ALL
TO authenticated
USING (get_user_school_role(school_id, 'admin'))
WITH CHECK (get_user_school_role(school_id, 'admin'));

-- Lessons table policies
CREATE POLICY "School admins can manage all lessons"
ON public.lessons FOR ALL
TO authenticated
USING (get_user_school_role(school_id, 'admin'))
WITH CHECK (get_user_school_role(school_id, 'admin'));

CREATE POLICY "Teachers can view their own lessons"
ON public.lessons FOR SELECT
TO authenticated
USING (
  has_school_access(school_id) AND 
  (get_user_school_role(school_id, 'admin') OR teacher_id = auth.uid())
); 