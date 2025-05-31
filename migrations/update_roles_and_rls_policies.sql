-- Update roles and RLS policies for proper school access control
-- This migration adds the superadmin role and updates RLS policies

-- First, update the user_schools table to support the new superadmin role
ALTER TABLE public.user_schools 
DROP CONSTRAINT IF EXISTS user_schools_role_check;

ALTER TABLE public.user_schools 
ADD CONSTRAINT user_schools_role_check 
CHECK (role IN ('admin', 'teacher', 'superadmin'));

-- Update helper functions to work with the new role system
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

-- Helper function to check if user is admin or superadmin
CREATE OR REPLACE FUNCTION public.is_school_admin_or_superadmin(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools us
    WHERE us.user_id = auth.uid()
    AND us.school_id = target_school_id
    AND us.role IN ('admin', 'superadmin')
    AND us.active = true
  );
$$;

-- Helper function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_school_superadmin(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_schools us
    WHERE us.user_id = auth.uid()
    AND us.school_id = target_school_id
    AND us.role = 'superadmin'
    AND us.active = true
  );
$$;

-- Drop existing school policies
DROP POLICY IF EXISTS "Users can view schools they belong to" ON public.schools;
DROP POLICY IF EXISTS "Authenticated users can create schools" ON public.schools;
DROP POLICY IF EXISTS "School admins can update their schools" ON public.schools;
DROP POLICY IF EXISTS "School admins can delete their schools" ON public.schools;

-- Create new school policies with proper role-based access
CREATE POLICY "Users can view schools they belong to"
ON public.schools FOR SELECT
TO authenticated
USING (id IN (SELECT school_id FROM get_user_school_ids()));

CREATE POLICY "Authenticated users can create schools"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "School admins and superadmins can update their schools"
ON public.schools FOR UPDATE
TO authenticated
USING (is_school_admin_or_superadmin(id))
WITH CHECK (is_school_admin_or_superadmin(id));

CREATE POLICY "Only superadmins can delete schools"
ON public.schools FOR DELETE
TO authenticated
USING (is_school_superadmin(id));

-- Update user_schools policies to handle the new role
DROP POLICY IF EXISTS "School admins can manage user memberships" ON public.user_schools;

CREATE POLICY "School admins and superadmins can manage user memberships"
ON public.user_schools FOR ALL
TO authenticated
USING (is_school_admin_or_superadmin(school_id))
WITH CHECK (is_school_admin_or_superadmin(school_id));

-- Update subjects policies
DROP POLICY IF EXISTS "School admins can manage subjects" ON public.subjects;

CREATE POLICY "School admins and superadmins can manage subjects"
ON public.subjects FOR ALL
TO authenticated
USING (is_school_admin_or_superadmin(school_id))
WITH CHECK (is_school_admin_or_superadmin(school_id));

-- Update teachers_subjects policies
DROP POLICY IF EXISTS "School admins can manage teacher-subject relationships" ON public.teachers_subjects;

CREATE POLICY "School admins and superadmins can manage teacher-subject relationships"
ON public.teachers_subjects FOR ALL
TO authenticated
USING (is_school_admin_or_superadmin(school_id))
WITH CHECK (is_school_admin_or_superadmin(school_id));

-- Update lessons policies
DROP POLICY IF EXISTS "School admins can manage all lessons" ON public.lessons;

CREATE POLICY "School admins and superadmins can manage all lessons"
ON public.lessons FOR ALL
TO authenticated
USING (is_school_admin_or_superadmin(school_id))
WITH CHECK (is_school_admin_or_superadmin(school_id)); 