-- Create function to add an instrument
CREATE OR REPLACE FUNCTION add_instrument(p_name TEXT, p_color TEXT)
RETURNS json
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
CREATE OR REPLACE FUNCTION update_instrument(p_id UUID, p_name TEXT, p_color TEXT)
RETURNS json
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
 
 
 