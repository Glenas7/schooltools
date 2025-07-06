-- Migration: Set up automated lesson exports using pg_cron
-- This creates the infrastructure for automatic exports based on auto_export_frequency

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to make HTTP requests to the export edge function
CREATE OR REPLACE FUNCTION export_lessons_via_http(school_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url text;
    service_role_key text;
    request_result bigint;
BEGIN
    -- Use hardcoded values for the current project
    -- This is safe since this function is only accessible to authenticated users
    supabase_url := 'https://xetfugvbiewwhpsxohne.supabase.co';
    
    -- For automated exports, we need to use a service role key
    -- This should be configured via Supabase secrets or environment variables
    -- For now, we'll use a placeholder that needs to be replaced in production
    service_role_key := current_setting('app.service_role_key', true);
    
    IF service_role_key IS NULL THEN
        -- Fallback: Try to get from a secrets table (if implemented)
        SELECT secret_value INTO service_role_key 
        FROM app_secrets 
        WHERE secret_name = 'supabase_service_role_key' 
        LIMIT 1;
    END IF;
    
    IF service_role_key IS NULL THEN
        RAISE EXCEPTION 'Service role key not configured. Please contact administrator to configure automated exports.';
    END IF;
    
    -- Make HTTP request to the export edge function
    SELECT net.http_post(
        url := supabase_url || '/functions/v1/export-lessons-to-sheet',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key,
            'apikey', service_role_key
        ),
        body := jsonb_build_object('school_id', school_id_param)
    ) INTO request_result;
    
    -- Log the result (optional, for debugging)
    INSERT INTO export_logs (school_id, export_type, status, created_at)
    VALUES (school_id_param, 'automated', 'completed', NOW());
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        INSERT INTO export_logs (school_id, export_type, status, error_message, created_at)
        VALUES (school_id_param, 'automated', 'failed', SQLERRM, NOW());
        RAISE;
END;
$$;

-- Create a table to log export attempts
CREATE TABLE IF NOT EXISTS export_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
    export_type text NOT NULL CHECK (export_type IN ('manual', 'automated')),
    status text NOT NULL CHECK (status IN ('completed', 'failed')),
    error_message text,
    created_at timestamptz DEFAULT NOW()
);

-- Create RLS policies for export_logs
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view export logs for their schools" ON export_logs
    FOR SELECT USING (
        school_id IN (
            SELECT us.school_id 
            FROM user_schools us 
            WHERE us.user_id = auth.uid() 
            AND us.active = true
        )
    );

-- Create a function to manage cron jobs for a school
CREATE OR REPLACE FUNCTION manage_export_cron_job(
    school_id_param uuid,
    frequency text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_name text;
    cron_schedule text;
    job_exists boolean;
BEGIN
    -- Create a unique job name for this school
    job_name := 'export_lessons_' || replace(school_id_param::text, '-', '_');
    
    -- Check if job already exists
    SELECT EXISTS(
        SELECT 1 FROM cron.job 
        WHERE jobname = job_name
    ) INTO job_exists;
    
    -- If frequency is NULL, get it from the database
    IF frequency IS NULL THEN
        SELECT s.auto_export_frequency INTO frequency
        FROM schools s
        WHERE s.id = school_id_param;
    END IF;
    
    -- Remove existing job if it exists
    IF job_exists THEN
        PERFORM cron.unschedule(job_name);
    END IF;
    
    -- Only create new job if frequency is not 'none'
    IF frequency IS NOT NULL AND frequency != 'none' THEN
        -- Determine cron schedule based on frequency
        CASE frequency
            WHEN 'hourly' THEN
                cron_schedule := '0 * * * *';  -- Every hour at minute 0
            WHEN 'daily' THEN
                cron_schedule := '0 2 * * *';  -- Every day at 2 AM
            WHEN 'weekly' THEN
                cron_schedule := '0 2 * * 0';  -- Every Sunday at 2 AM
            ELSE
                RAISE EXCEPTION 'Invalid frequency: %', frequency;
        END CASE;
        
        -- Schedule the new job
        PERFORM cron.schedule(
            job_name,
            cron_schedule,
            'SELECT export_lessons_via_http(''' || school_id_param || ''');'
        );
    END IF;
END;
$$;

-- Create a function to handle auto_export_frequency changes
CREATE OR REPLACE FUNCTION handle_export_frequency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only process if auto_export_frequency has changed
    IF OLD.auto_export_frequency IS DISTINCT FROM NEW.auto_export_frequency THEN
        -- Only create cron jobs if export is configured
        IF NEW.export_google_sheet_url IS NOT NULL AND NEW.export_google_sheet_url != '' THEN
            PERFORM manage_export_cron_job(NEW.id, NEW.auto_export_frequency);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically manage cron jobs when auto_export_frequency changes
DROP TRIGGER IF EXISTS trigger_export_frequency_change ON schools;
CREATE TRIGGER trigger_export_frequency_change
    AFTER UPDATE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION handle_export_frequency_change();

-- Create a function to clean up cron jobs when a school is deleted or deactivated
CREATE OR REPLACE FUNCTION cleanup_export_cron_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_name text;
BEGIN
    -- Create the job name that would have been used
    job_name := 'export_lessons_' || replace(OLD.id::text, '-', '_');
    
    -- Remove the cron job if it exists
    BEGIN
        PERFORM cron.unschedule(job_name);
    EXCEPTION
        WHEN OTHERS THEN
            -- Job might not exist, which is fine
            NULL;
    END;
    
    RETURN OLD;
END;
$$;

-- Create triggers to clean up cron jobs when schools are deleted or deactivated
DROP TRIGGER IF EXISTS trigger_cleanup_export_cron_update ON schools;
DROP TRIGGER IF EXISTS trigger_cleanup_export_cron_delete ON schools;

-- Trigger for when schools are deactivated or marked as deleted
CREATE TRIGGER trigger_cleanup_export_cron_update
    AFTER UPDATE OF active, deleted ON schools
    FOR EACH ROW
    WHEN (OLD.active = true AND (NEW.active = false OR NEW.deleted = true))
    EXECUTE FUNCTION cleanup_export_cron_job();

-- Trigger for when schools are deleted
CREATE TRIGGER trigger_cleanup_export_cron_delete
    AFTER DELETE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_export_cron_job();

-- Create a function for admins to manually manage export schedules
CREATE OR REPLACE FUNCTION admin_manage_school_export_schedule(
    target_school_id uuid,
    new_frequency text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    -- Check if the current user is admin or superadmin for this school
    SELECT us.role INTO user_role
    FROM user_schools us
    WHERE us.user_id = auth.uid()
    AND us.school_id = target_school_id
    AND us.active = true;
    
    IF user_role NOT IN ('admin', 'superadmin') THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Validate frequency
    IF new_frequency NOT IN ('none', 'hourly', 'daily', 'weekly') THEN
        RAISE EXCEPTION 'Invalid frequency. Must be none, hourly, daily, or weekly.';
    END IF;
    
    -- Update the school's auto_export_frequency (this will trigger the automatic cron job management)
    UPDATE schools 
    SET auto_export_frequency = new_frequency
    WHERE id = target_school_id;
    
    RETURN true;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres; 