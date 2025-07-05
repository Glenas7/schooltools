-- Create locations table and add location_id to lessons
-- This migration adds the missing location functionality

-- Create locations table
CREATE TABLE public.locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(school_id, name)
);

-- Add location_id to lessons table
ALTER TABLE public.lessons 
ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_locations_school_id ON public.locations(school_id);
CREATE INDEX idx_lessons_location_id ON public.lessons(location_id);

-- Enable Row Level Security
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for locations table
CREATE POLICY "School members can view locations" ON public.locations
    FOR SELECT
    USING (
        school_id IN (
            SELECT school_id 
            FROM public.user_schools 
            WHERE user_id = auth.uid() AND active = true
        )
    );

CREATE POLICY "School admins can manage locations" ON public.locations
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id 
            FROM public.user_schools 
            WHERE user_id = auth.uid() AND role = 'admin' AND active = true
        )
    ); 