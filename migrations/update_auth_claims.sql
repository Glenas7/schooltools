-- Create a function to properly set the custom claims
CREATE OR REPLACE FUNCTION public.update_custom_claims()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger properly formats the role claims for JWT tokens
  -- This fixes the "Token 'admin' is invalid" error
  
  -- When role is 'admin', ensure it's formatted as proper JSON
  IF NEW.raw_app_meta_data->>'role' = 'admin' THEN
    NEW.raw_app_meta_data = jsonb_set(
      NEW.raw_app_meta_data,
      '{role}',
      to_jsonb('admin'::text)  -- proper JSON format
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run on user insert or update
DROP TRIGGER IF EXISTS update_claims_trigger ON auth.users;
CREATE TRIGGER update_claims_trigger
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_custom_claims();

-- Fix existing users
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{role}',
  to_jsonb('admin'::text)
)
WHERE raw_app_meta_data->>'role' = 'admin'; 
 
 
 