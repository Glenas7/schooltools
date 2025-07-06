-- Migration: Add timezone support for export scheduling
-- This allows users to enter local time which gets converted to UTC for cron jobs

-- Add timezone field to schools table
ALTER TABLE schools 
ADD COLUMN export_timezone text DEFAULT 'UTC';

-- Add comment for documentation
COMMENT ON COLUMN schools.export_timezone IS 'Timezone for export scheduling (e.g., Europe/Madrid, America/New_York, UTC)';

-- Updated function to manage cron jobs with timezone conversion
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
    schedule_time text;
    schedule_day integer;
    school_timezone text;
    local_time time;
    utc_time time;
    hour_part integer;
    minute_part integer;
    cron_day text;
    utc_timestamp timestamptz;
    local_timestamp timestamptz;
BEGIN
    -- Create a unique job name for this school
    job_name := 'export_lessons_' || replace(school_id_param::text, '-', '_');
    
    -- Check if job already exists
    SELECT EXISTS(
        SELECT 1 FROM cron.job 
        WHERE jobname = job_name
    ) INTO job_exists;
    
    -- If frequency is NULL, get it from the database along with schedule settings
    IF frequency IS NULL THEN
        SELECT s.auto_export_frequency, s.export_schedule_time, s.export_schedule_day, s.export_timezone
        INTO frequency, schedule_time, schedule_day, school_timezone
        FROM schools s
        WHERE s.id = school_id_param;
    ELSE
        -- Get schedule settings from database
        SELECT s.export_schedule_time, s.export_schedule_day, s.export_timezone
        INTO schedule_time, schedule_day, school_timezone
        FROM schools s
        WHERE s.id = school_id_param;
    END IF;
    
    -- Set defaults if not configured
    schedule_time := COALESCE(schedule_time, '09:00:00');
    schedule_day := COALESCE(schedule_day, 1); -- Default to Monday
    school_timezone := COALESCE(school_timezone, 'UTC');
    
    -- Convert local time to UTC
    local_time := schedule_time::time;
    
    -- Create a timestamp in the school's timezone and convert to UTC
    -- We use today's date just for conversion purposes
    local_timestamp := (CURRENT_DATE || ' ' || schedule_time)::timestamp AT TIME ZONE school_timezone;
    utc_timestamp := local_timestamp AT TIME ZONE 'UTC';
    utc_time := utc_timestamp::time;
    
    -- Extract hour and minute from UTC time
    hour_part := EXTRACT(HOUR FROM utc_time);
    minute_part := EXTRACT(MINUTE FROM utc_time);
    
    -- Remove existing job if it exists
    IF job_exists THEN
        PERFORM cron.unschedule(job_name);
    END IF;
    
    -- Only create new job if frequency is not 'none'
    IF frequency IS NOT NULL AND frequency != 'none' THEN
        -- Determine cron schedule based on frequency
        CASE frequency
            WHEN 'hourly' THEN
                -- For hourly, ignore the schedule_time and run every hour at minute 0
                cron_schedule := '0 * * * *';
            WHEN 'daily' THEN
                -- Use the UTC-converted time for daily exports
                cron_schedule := minute_part || ' ' || hour_part || ' * * *';
            WHEN 'weekly' THEN
                -- Convert schedule_day (1=Monday, 7=Sunday) to cron format (0=Sunday, 1=Monday)
                IF schedule_day = 7 THEN
                    cron_day := '0';  -- Sunday
                ELSE
                    cron_day := schedule_day::text;  -- Monday=1, Tuesday=2, etc.
                END IF;
                -- Use the UTC-converted time and day for weekly exports
                cron_schedule := minute_part || ' ' || hour_part || ' * * ' || cron_day;
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

-- Updated trigger function to also watch for timezone changes
CREATE OR REPLACE FUNCTION handle_export_frequency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Process if any export-related field has changed
    IF (OLD.auto_export_frequency IS DISTINCT FROM NEW.auto_export_frequency) OR
       (OLD.export_schedule_time IS DISTINCT FROM NEW.export_schedule_time) OR
       (OLD.export_schedule_day IS DISTINCT FROM NEW.export_schedule_day) OR
       (OLD.export_timezone IS DISTINCT FROM NEW.export_timezone) THEN
        
        -- Only create cron jobs if export is configured
        IF NEW.export_google_sheet_url IS NOT NULL AND NEW.export_google_sheet_url != '' THEN
            PERFORM manage_export_cron_job(NEW.id, NEW.auto_export_frequency);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Update the trigger to watch for timezone changes too
DROP TRIGGER IF EXISTS trigger_export_frequency_change ON schools;
CREATE TRIGGER trigger_export_frequency_change
    AFTER UPDATE OF auto_export_frequency, export_schedule_time, export_schedule_day, export_timezone ON schools
    FOR EACH ROW
    EXECUTE FUNCTION handle_export_frequency_change();

-- Update the admin function to handle timezone
CREATE OR REPLACE FUNCTION admin_manage_school_export_schedule(
    target_school_id uuid,
    new_frequency text,
    new_schedule_time text DEFAULT NULL,
    new_schedule_day integer DEFAULT NULL,
    new_timezone text DEFAULT NULL
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
    
    -- Validate schedule_day if provided
    IF new_schedule_day IS NOT NULL AND (new_schedule_day < 1 OR new_schedule_day > 7) THEN
        RAISE EXCEPTION 'Invalid schedule day. Must be between 1 (Monday) and 7 (Sunday).';
    END IF;
    
    -- Update the school's export settings (this will trigger the automatic cron job management)
    UPDATE schools 
    SET 
        auto_export_frequency = new_frequency,
        export_schedule_time = COALESCE(new_schedule_time, export_schedule_time),
        export_schedule_day = COALESCE(new_schedule_day, export_schedule_day),
        export_timezone = COALESCE(new_timezone, export_timezone)
    WHERE id = target_school_id;
    
    RETURN true;
END;
$$; 