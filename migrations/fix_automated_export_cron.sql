-- Migration: Fix automated export cron jobs to work with Edge Function environment variables
-- This fixes the export_lessons_via_http function to properly call the Edge Function

-- Updated function to make HTTP requests to the export edge function
CREATE OR REPLACE FUNCTION export_lessons_via_http(school_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url text;
    anon_key text;
    request_result bigint;
BEGIN
    -- Use the project URL and anon key (Edge Function will use its own service role key internally)
    supabase_url := 'https://xetfugvbiewwhpsxohne.supabase.co';
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGZ1Z3ZiaWV3d2hwc3hvaG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE0MzEzNjcsImV4cCI6MjA0NzAwNzM2N30.ggvEJTqOxIB2xQrJEVpgwBKjZPCCo0XiAhM8-F3Ck8k';
    
    -- Make HTTP request to the export edge function
    -- The Edge Function will use its automatic SUPABASE_SERVICE_ROLE_KEY environment variable
    SELECT net.http_post(
        url := supabase_url || '/functions/v1/export-lessons-to-sheet',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key,
            'apikey', anon_key
        ),
        body := jsonb_build_object(
            'school_id', school_id_param,
            'source', 'automated'
        )
    ) INTO request_result;
    
    -- Log successful completion
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