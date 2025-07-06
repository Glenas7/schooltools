-- Migration: Create secure secrets table for automated exports
-- This provides a secure way to store the service role key for automated exports

-- Create a secure table for storing application secrets
CREATE TABLE IF NOT EXISTS app_secrets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    secret_name text UNIQUE NOT NULL,
    secret_value text NOT NULL,
    description text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- Enable RLS and create restrictive policies
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- Only allow superadmin users to access secrets
CREATE POLICY "Only superadmin can access secrets" ON app_secrets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_schools us 
            WHERE us.user_id = auth.uid() 
            AND us.role = 'superadmin' 
            AND us.active = true
        )
    );

-- Create a function for superadmins to safely set the service role key
CREATE OR REPLACE FUNCTION set_service_role_key(key_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    -- Check if the current user is a superadmin
    SELECT us.role INTO user_role
    FROM user_schools us
    WHERE us.user_id = auth.uid()
    AND us.role = 'superadmin'
    AND us.active = true
    LIMIT 1;
    
    IF user_role != 'superadmin' THEN
        RAISE EXCEPTION 'Access denied. Superadmin privileges required.';
    END IF;
    
    -- Insert or update the service role key
    INSERT INTO app_secrets (secret_name, secret_value, description)
    VALUES (
        'supabase_service_role_key', 
        key_value, 
        'Service role key for automated exports'
    )
    ON CONFLICT (secret_name) 
    DO UPDATE SET 
        secret_value = EXCLUDED.secret_value,
        updated_at = NOW();
    
    RETURN true;
END;
$$;

-- Create a function to safely retrieve secrets (used by automated export function)
CREATE OR REPLACE FUNCTION get_secret(secret_name_param text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    secret_val text;
BEGIN
    SELECT secret_value INTO secret_val
    FROM app_secrets
    WHERE secret_name = secret_name_param;
    
    RETURN secret_val;
END;
$$;

-- Update the export function to use the secrets table
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
    -- Use the current project URL
    supabase_url := 'https://xetfugvbiewwhpsxohne.supabase.co';
    
    -- Get the service role key from the secrets table
    service_role_key := get_secret('supabase_service_role_key');
    
    IF service_role_key IS NULL THEN
        RAISE EXCEPTION 'Service role key not configured. Please ask a superadmin to configure automated exports using the Settings page.';
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