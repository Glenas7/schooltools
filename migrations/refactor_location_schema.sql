-- Migration: Refactor location schema to use location_id field on lessons table instead of lesson_locations table
-- This migration adds location_id to lessons table, migrates existing data, and drops lesson_locations table

-- Step 1: Add location_id column to lessons table
ALTER TABLE lessons 
ADD COLUMN location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

-- Step 2: Migrate existing data from lesson_locations to lessons.location_id
UPDATE lessons 
SET location_id = ll.location_id 
FROM lesson_locations ll 
WHERE lessons.id = ll.lesson_id;

-- Step 3: Drop the lesson_locations table
DROP TABLE lesson_locations;

-- Step 4: Add index on location_id for performance
CREATE INDEX idx_lessons_location_id ON lessons(location_id); 