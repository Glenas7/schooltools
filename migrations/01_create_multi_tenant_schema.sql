-- School Scheduler Multi-tenant Database Schema
-- This migration creates the base multi-tenant structure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools table - the core of our multi-tenancy
CREATE TABLE public.schools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    google_sheet_url TEXT,
    settings JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Users table - linked to auth.users
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User-School relationships with roles
CREATE TABLE public.user_schools (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, school_id)
);

-- Subjects table (formerly instruments)
CREATE TABLE public.subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(school_id, name)
);

-- Teachers-Subjects relationship
CREATE TABLE public.teachers_subjects (
    teacher_id UUID NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (teacher_id, subject_id),
    FOREIGN KEY (teacher_id, school_id) REFERENCES public.user_schools(user_id, school_id) ON DELETE CASCADE
);

-- Lessons table
CREATE TABLE public.lessons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    student_name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    teacher_id UUID,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE RESTRICT NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    FOREIGN KEY (teacher_id, school_id) REFERENCES public.user_schools(user_id, school_id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_schools_active ON public.schools(active);
CREATE INDEX idx_user_schools_school_id ON public.user_schools(school_id);
CREATE INDEX idx_user_schools_user_id ON public.user_schools(user_id);
CREATE INDEX idx_user_schools_role ON public.user_schools(role);
CREATE INDEX idx_subjects_school_id ON public.subjects(school_id);
CREATE INDEX idx_teachers_subjects_school_id ON public.teachers_subjects(school_id);
CREATE INDEX idx_teachers_subjects_teacher_id ON public.teachers_subjects(teacher_id);
CREATE INDEX idx_lessons_school_id ON public.lessons(school_id);
CREATE INDEX idx_lessons_teacher_id ON public.lessons(teacher_id);
CREATE INDEX idx_lessons_subject_id ON public.lessons(subject_id);
CREATE INDEX idx_lessons_day_of_week ON public.lessons(day_of_week);
CREATE INDEX idx_lessons_start_date ON public.lessons(start_date);
CREATE INDEX idx_lessons_end_date ON public.lessons(end_date);

-- Enable Row Level Security
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY; 