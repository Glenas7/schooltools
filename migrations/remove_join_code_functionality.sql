-- Migration: Remove join code functionality
-- This migration safely removes the join_code feature from schools

-- Remove the unique index on join_code
DROP INDEX IF EXISTS idx_schools_join_code;

-- Remove the join_code column from schools table
ALTER TABLE public.schools 
DROP COLUMN IF EXISTS join_code;

-- Remove any functions that specifically handled join codes
-- (The main functions are in SchoolsProvider, this is just cleanup)

-- Update the handle_school_created function to not generate join codes
CREATE OR REPLACE FUNCTION public.handle_school_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the creator as a superadmin of the new school (upgraded from admin)
  INSERT INTO public.user_schools (user_id, school_id, role, active)
  VALUES (auth.uid(), NEW.id, 'superadmin', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to document the change
COMMENT ON TABLE public.schools IS 'Schools table - join codes removed as they are not needed for targeted user applications'; 