-- Migration: Add slug functionality to schools table
-- This adds URL-friendly slugs for schools with proper validation and constraints

-- Add slug column to schools table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schools' AND column_name = 'slug') THEN
        ALTER TABLE public.schools ADD COLUMN slug TEXT;
    END IF;
END $$;

-- Create unique index for slug (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'schools_slug_unique_idx') THEN
        CREATE UNIQUE INDEX schools_slug_unique_idx ON public.schools(slug) 
        WHERE slug IS NOT NULL AND active = true AND deleted = false;
    END IF;
END $$;

-- Create reserved school slugs table
CREATE TABLE IF NOT EXISTS public.reserved_school_slugs (
    slug TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Populate reserved slugs
INSERT INTO public.reserved_school_slugs (slug, reason) VALUES
    ('api', 'System endpoint'),
    ('admin', 'Administrative interface'),
    ('www', 'Web root'),
    ('app', 'Application root'),
    ('dashboard', 'Dashboard interface'),
    ('login', 'Authentication'),
    ('signup', 'Registration'),
    ('auth', 'Authentication system'),
    ('supabase', 'Database system'),
    ('vercel', 'Hosting platform'),
    ('github', 'Source control'),
    ('docs', 'Documentation'),
    ('help', 'Help system'),
    ('support', 'Customer support'),
    ('blog', 'Blog content'),
    ('news', 'News content'),
    ('about', 'About page'),
    ('contact', 'Contact information'),
    ('privacy', 'Privacy policy'),
    ('terms', 'Terms of service'),
    ('legal', 'Legal information'),
    ('billing', 'Billing system'),
    ('payment', 'Payment processing'),
    ('settings', 'System settings'),
    ('profile', 'User profiles'),
    ('account', 'Account management'),
    ('security', 'Security settings'),
    ('notifications', 'Notification system'),
    ('email', 'Email system'),
    ('sms', 'SMS system'),
    ('webhook', 'Webhook system'),
    ('api-v1', 'API version 1'),
    ('api-v2', 'API version 2'),
    ('api-v3', 'API version 3'),
    ('staging', 'Staging environment'),
    ('dev', 'Development environment'),
    ('test', 'Testing environment'),
    ('preview', 'Preview environment'),
    ('demo', 'Demo environment'),
    ('sandbox', 'Sandbox environment'),
    ('production', 'Production environment'),
    ('cdn', 'Content delivery network'),
    ('static', 'Static content'),
    ('assets', 'Asset delivery'),
    ('uploads', 'File uploads'),
    ('downloads', 'File downloads'),
    ('media', 'Media content'),
    ('images', 'Image content'),
    ('videos', 'Video content'),
    ('files', 'File storage'),
    ('backup', 'Backup system'),
    ('archive', 'Archive system'),
    ('logs', 'Log system'),
    ('metrics', 'Metrics system'),
    ('analytics', 'Analytics system'),
    ('monitoring', 'Monitoring system'),
    ('status', 'Status page'),
    ('health', 'Health checks'),
    ('ping', 'System ping'),
    ('robots', 'Robots.txt'),
    ('sitemap', 'Site map'),
    ('rss', 'RSS feeds'),
    ('feed', 'Content feeds'),
    ('scheduler', 'Scheduler module'),
    ('menus', 'Menus module'),
    ('events', 'Events module'),
    ('calendar', 'Calendar system'),
    ('timetable', 'Timetable system')
ON CONFLICT (slug) DO NOTHING;

-- Function to generate a slug from text
CREATE OR REPLACE FUNCTION public.generate_school_slug(input_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
    suffix TEXT := '';
BEGIN
    -- Convert to lowercase and replace spaces/special chars with hyphens
    base_slug := lower(regexp_replace(trim(input_name), '[^a-zA-Z0-9\s\-]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(base_slug, '-');
    
    -- Ensure it's not empty and has minimum length
    IF base_slug = '' OR length(base_slug) < 3 THEN
        base_slug := 'school-' || substr(md5(input_name || random()::text), 1, 8);
    END IF;
    
    -- Ensure it's not too long
    IF length(base_slug) > 45 THEN
        base_slug := substr(base_slug, 1, 45);
        base_slug := trim(base_slug, '-');
    END IF;
    
    -- Check for uniqueness and reserved words
    final_slug := base_slug;
    WHILE EXISTS (
        SELECT 1 FROM public.schools WHERE slug = final_slug AND active = true AND deleted = false
    ) OR EXISTS (
        SELECT 1 FROM public.reserved_school_slugs WHERE slug = final_slug
    ) LOOP
        counter := counter + 1;
        suffix := '-' || counter;
        
        -- Make sure the slug with suffix doesn't exceed 50 chars
        IF length(base_slug || suffix) > 50 THEN
            base_slug := substr(base_slug, 1, 50 - length(suffix));
            base_slug := trim(base_slug, '-');
        END IF;
        
        final_slug := base_slug || suffix;
        
        -- Safety check to prevent infinite loops
        IF counter > 1000 THEN
            final_slug := 'school-' || substr(md5(input_name || random()::text), 1, 8);
            EXIT;
        END IF;
    END LOOP;
    
    RETURN final_slug;
END;
$$;

-- Function to validate if a slug is available
CREATE OR REPLACE FUNCTION public.is_valid_school_slug(
    input_slug TEXT,
    exclude_school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    cleaned_slug TEXT;
BEGIN
    -- Clean and validate the input slug
    cleaned_slug := lower(trim(input_slug));
    
    -- Basic validation
    IF cleaned_slug = '' OR length(cleaned_slug) < 3 OR length(cleaned_slug) > 50 THEN
        RETURN FALSE;
    END IF;
    
    -- Pattern validation (lowercase letters, numbers, hyphens only)
    IF NOT cleaned_slug ~ '^[a-z0-9]+([a-z0-9\-]*[a-z0-9]+)*$' THEN
        RETURN FALSE;
    END IF;
    
    -- Check if slug is reserved
    IF EXISTS (SELECT 1 FROM public.reserved_school_slugs WHERE slug = cleaned_slug) THEN
        RETURN FALSE;
    END IF;
    
    -- Check if slug is already taken by another school
    IF EXISTS (
        SELECT 1 FROM public.schools 
        WHERE slug = cleaned_slug 
        AND active = true 
        AND deleted = false
        AND (exclude_school_id IS NULL OR id != exclude_school_id)
    ) THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Function to get school by slug
CREATE OR REPLACE FUNCTION public.get_school_by_slug(school_slug TEXT)
RETURNS TABLE(
    id UUID,
    name TEXT,
    description TEXT,
    slug TEXT,
    google_sheet_url TEXT,
    settings JSONB,
    active BOOLEAN,
    deleted BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        s.id,
        s.name,
        s.description,
        s.slug,
        s.google_sheet_url,
        s.settings,
        s.active,
        s.deleted,
        s.created_at,
        s.updated_at
    FROM public.schools s
    WHERE s.slug = lower(trim(school_slug))
    AND s.active = true
    AND s.deleted = false;
$$;

-- Function to auto-generate slug on school creation
CREATE OR REPLACE FUNCTION public.generate_slug_on_school_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate slug if it's not provided
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.generate_school_slug(NEW.name);
    ELSE
        -- Validate and clean provided slug
        NEW.slug := lower(trim(NEW.slug));
        IF NOT public.is_valid_school_slug(NEW.slug, NEW.id) THEN
            RAISE EXCEPTION 'Invalid or taken slug: %', NEW.slug;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating slugs
DROP TRIGGER IF EXISTS trigger_generate_school_slug ON public.schools;
CREATE TRIGGER trigger_generate_school_slug
    BEFORE INSERT OR UPDATE ON public.schools
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_slug_on_school_insert();

-- Generate slugs for existing schools that don't have them
UPDATE public.schools 
SET slug = public.generate_school_slug(name)
WHERE slug IS NULL OR slug = '';

-- Add constraint to ensure slug is not null for active schools
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'schools_slug_not_null_when_active'
    ) THEN
        ALTER TABLE public.schools 
        ADD CONSTRAINT schools_slug_not_null_when_active 
        CHECK ((active = false AND deleted = true) OR slug IS NOT NULL);
    END IF;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.generate_school_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_school_slug(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_by_slug(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON COLUMN public.schools.slug IS 'URL-friendly identifier for the school (e.g., "la-miranda-music"). Must be unique, lowercase, 3-50 chars, letters/numbers/hyphens only.';
COMMENT ON TABLE public.reserved_school_slugs IS 'Slugs that cannot be used for schools to avoid conflicts with system routes.'; 