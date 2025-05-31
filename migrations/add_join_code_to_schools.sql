-- Add join_code column to schools table
-- This migration adds the missing join_code column that the frontend expects

ALTER TABLE public.schools 
ADD COLUMN join_code TEXT;

-- Create a unique index on join_code for fast lookups and uniqueness
CREATE UNIQUE INDEX idx_schools_join_code ON public.schools(join_code) WHERE join_code IS NOT NULL;

-- Generate join codes for existing schools
UPDATE public.schools 
SET join_code = UPPER(substr(md5(random()::text), 1, 6))
WHERE join_code IS NULL; 