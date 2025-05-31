-- Fix admin role claim format in JWT tokens
-- This addresses the root cause of the "Token 'admin' is invalid" error

-- Create or replace the function that formats user claims properly
CREATE OR REPLACE FUNCTION public.format_user_claims() 
RETURNS trigger AS $$
BEGIN
  -- Check if role is 'admin' and format it properly as JSON
  IF NEW.raw_app_meta_data->>'role' = 'admin' THEN
    NEW.raw_app_meta_data = jsonb_set(
      NEW.raw_app_meta_data,
      '{role}',
      to_jsonb('admin'::text)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that runs on user insert and update
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.format_user_claims();

-- Update existing admin users to fix their role claims
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{role}',
  to_jsonb('admin'::text)
)
WHERE raw_app_meta_data->>'role' = 'admin';

-- Also update the raw_user_meta_data if it contains a role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data, 
  '{role}',
  to_jsonb('admin'::text)
)
WHERE raw_user_meta_data->>'role' = 'admin';

-- Log a message indicating the fix was applied
DO $$
BEGIN
  RAISE NOTICE 'Admin role claim format has been fixed for all users';
END $$; 
 
 
 