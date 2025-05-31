-- Fix both auth claims and instrument functions

-- 1. First fix the admin role claim format
CREATE OR REPLACE FUNCTION public.update_custom_claims()
RETURNS TRIGGER AS $$
BEGIN
  -- When role is 'admin', ensure it's properly formatted as JSON
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

-- Create trigger for auth claims
DROP TRIGGER IF EXISTS update_claims_trigger ON auth.users;
CREATE TRIGGER update_claims_trigger
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_custom_claims();

-- Fix existing admin users
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{role}',
  to_jsonb('admin'::text)
)
WHERE raw_app_meta_data->>'role' = 'admin';

-- 2. Now create the instrument functions with proper RPC exposure

-- Enable RPC for these functions
ALTER ROLE authenticator SET search_path TO public, extensions;
GRANT EXECUTE ON FUNCTION public.add_instrument(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_instrument(uuid, text, text) TO anon, authenticated;

-- Create function to add an instrument
CREATE OR REPLACE FUNCTION public.add_instrument(
  p_name TEXT,
  p_color TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instrument json;
BEGIN
  -- Validate inputs
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Instrument name cannot be empty';
  END IF;
  
  IF p_color IS NULL OR p_color = '' THEN
    RAISE EXCEPTION 'Instrument color cannot be empty';
  END IF;

  -- Insert the instrument
  INSERT INTO public.instruments (name, color)
  VALUES (p_name, p_color)
  RETURNING json_build_object(
    'id', id,
    'name', name,
    'color', color
  ) INTO v_instrument;
  
  RETURN v_instrument;
EXCEPTION
  WHEN others THEN
    RAISE;
END;
$$;

-- Create function to update an instrument
CREATE OR REPLACE FUNCTION public.update_instrument(
  p_id UUID,
  p_name TEXT,
  p_color TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instrument json;
BEGIN
  -- Validate inputs
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Instrument ID cannot be null';
  END IF;
  
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Instrument name cannot be empty';
  END IF;
  
  IF p_color IS NULL OR p_color = '' THEN
    RAISE EXCEPTION 'Instrument color cannot be empty';
  END IF;

  -- Update the instrument
  UPDATE public.instruments
  SET 
    name = p_name,
    color = p_color,
    updated_at = now()
  WHERE id = p_id
  RETURNING json_build_object(
    'id', id,
    'name', name,
    'color', color
  ) INTO v_instrument;
  
  IF v_instrument IS NULL THEN
    RAISE EXCEPTION 'Instrument with ID % not found', p_id;
  END IF;
  
  RETURN v_instrument;
EXCEPTION
  WHEN others THEN
    RAISE;
END;
$$;

-- Grant execute permissions explicitly
GRANT EXECUTE ON FUNCTION public.add_instrument(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_instrument(uuid, text, text) TO anon, authenticated; 
 
 
 