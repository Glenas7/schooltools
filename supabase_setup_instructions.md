# Supabase Setup Instructions

## Fixing Authentication and RLS Policies

We've found a better solution to the instrument management issues by updating the Row Level Security (RLS) policies rather than creating custom RPC functions.

Follow these steps:

1. Open your Supabase dashboard
2. Navigate to the SQL Editor section
3. Create a new query
4. Copy and paste the following SQL:

```sql
-- Fixed RLS policies for instruments table to properly check admin role
DROP POLICY IF EXISTS "Admins can delete instruments" ON public.instruments;
DROP POLICY IF EXISTS "Admins can insert instruments" ON public.instruments;
DROP POLICY IF EXISTS "Admins can update instruments" ON public.instruments;

-- Create updated policies that check for 'admin' role
CREATE POLICY "Admins can delete instruments"
ON public.instruments
FOR DELETE 
TO authenticated
USING (get_my_claim('role')::text = 'admin');

CREATE POLICY "Admins can insert instruments"
ON public.instruments
FOR INSERT 
TO authenticated
WITH CHECK (get_my_claim('role')::text = 'admin');

CREATE POLICY "Admins can update instruments"
ON public.instruments
FOR UPDATE 
TO authenticated
USING (get_my_claim('role')::text = 'admin')
WITH CHECK (get_my_claim('role')::text = 'admin');
```

5. Run the query to update the policies

The issue was with RLS policies expecting the admin role claim in a specific format. We've simplified the policies to check for role='admin' without requiring specific JSON formatting.

## Code Updates

We've also updated the application code to:

1. Remove the RPC helper functions (no longer needed)
2. Revert to using standard Supabase client methods for data operations

## Testing

After applying these changes:

1. Sign out and back in (to get a new JWT token)
2. Try adding a new instrument
3. Try editing an existing instrument

These changes provide a cleaner, more maintainable solution that addresses the root issue rather than working around it.

## Fixing Instrument Management with a Custom Admin Check Function

We've found an elegant solution to the "Token 'admin' is invalid" error by creating a simple boolean function that directly checks the admin role:

1. Open your Supabase dashboard
2. Navigate to the SQL Editor section
3. Create a new query
4. Copy and paste the following SQL:

```sql
-- Create a helper function specifically for checking admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Check if the user's role claim is 'admin' as plain text
  SELECT current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'admin';
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can delete instruments" ON public.instruments;
DROP POLICY IF EXISTS "Admins can insert instruments" ON public.instruments;
DROP POLICY IF EXISTS "Admins can update instruments" ON public.instruments;

-- Create updated policies using the is_admin() function
CREATE POLICY "Admins can delete instruments"
ON public.instruments
FOR DELETE 
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert instruments"
ON public.instruments
FOR INSERT 
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can update instruments"
ON public.instruments
FOR UPDATE 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
```

5. Run the query to create the helper function and update policies

## Why This Approach Works

This solution:

1. Creates a dedicated `is_admin()` function that extracts the role claim directly as text
2. Compares the text value to 'admin' without JSON formatting concerns
3. Uses this simple boolean function in all RLS policies
4. Allows you to use standard Supabase client methods without custom RPC functions

The function elegantly handles the mismatch between how the admin role is stored in JWT tokens and how PostgreSQL traditionally expects it when checking RLS policies.

## Testing

After applying these changes:

1. Try adding a new instrument
2. Try editing an existing instrument

You should now be able to perform these operations without any "Token 'admin' is invalid" errors.

## Fixing Role-Based Access with Custom Helper Functions

We've found an elegant solution to the "Token 'admin' is invalid" error by creating simple helper functions that correctly check roles for RLS policies:

1. Open your Supabase dashboard
2. Navigate to the SQL Editor section
3. Create a new query
4. Copy and paste the following SQL:

```sql
-- Create helper functions for role checking
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Check if the user's role claim is 'admin' as plain text
  SELECT current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Check if the user's role claim is 'teacher' 
  SELECT current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'teacher';
$$;

CREATE OR REPLACE FUNCTION public.is_same_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Check if the user is operating on their own data
  SELECT user_id = auth.uid();
$$;

-- Update RLS policies for instruments table
DROP POLICY IF EXISTS "Admins can delete instruments" ON public.instruments;
DROP POLICY IF EXISTS "Admins can insert instruments" ON public.instruments;
DROP POLICY IF EXISTS "Admins can update instruments" ON public.instruments;

CREATE POLICY "Admins can delete instruments"
ON public.instruments
FOR DELETE 
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert instruments"
ON public.instruments
FOR INSERT 
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can update instruments"
ON public.instruments
FOR UPDATE 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Update RLS policies for the public.users table
DROP POLICY IF EXISTS "Admins can insert new users" ON public.users;
CREATE POLICY "Admins can insert new users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update any user profile" ON public.users;
CREATE POLICY "Admins can update any user profile"
ON public.users
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
TO authenticated
USING (is_admin());

-- Update policies for teachers_instruments table
DROP POLICY IF EXISTS "Admins can insert teacher_instrument links" ON public.teachers_instruments;
CREATE POLICY "Admins can insert teacher_instrument links"
ON public.teachers_instruments
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete teacher_instrument links" ON public.teachers_instruments;
CREATE POLICY "Admins can delete teacher_instrument links"
ON public.teachers_instruments
FOR DELETE
TO authenticated
USING (is_admin());
```

5. Run the query to create the helper functions and update policies

## Fixing Teacher Updates with a Sync Trigger

To address the issue where teacher updates need to sync between the `public.users` and `auth.users` tables:

1. Create a new query in the SQL Editor
2. Copy and paste the following SQL:

```sql
-- Create a trigger function to keep the auth.users table in sync
CREATE OR REPLACE FUNCTION public.sync_public_user_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync when a teacher is updated
  IF TG_OP = 'UPDATE' THEN
    -- Update the auth.users metadata to match the public.users data
    UPDATE auth.users
    SET 
      raw_user_meta_data = jsonb_set(
        raw_user_meta_data,
        '{name}',
        to_jsonb(NEW.name)
      ),
      raw_app_meta_data = jsonb_set(
        raw_app_meta_data,
        '{active}',
        to_jsonb(NEW.active)
      )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync public.users changes to auth.users
DROP TRIGGER IF EXISTS sync_public_user_to_auth_trigger ON public.users;
CREATE TRIGGER sync_public_user_to_auth_trigger
AFTER UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_user_to_auth();
```

3. Run the query to create the sync trigger

## Why This Approach Works

This solution:

1. Creates dedicated helper functions that extract role claims directly as text
2. Compares the text values without JSON formatting concerns
3. Uses these simple functions in all RLS policies
4. Adds a sync trigger so that standard updates to `public.users` automatically update `auth.users`
5. Allows you to use standard Supabase client methods without custom RPC functions

The functions elegantly handle the mismatch between how roles are stored in JWT tokens and how PostgreSQL traditionally expects them in RLS policies.

## Testing

After applying these changes:

1. Try adding a new instrument
2. Try editing an existing instrument
3. Try activating/deactivating a teacher
4. Try updating a teacher's name

You should now be able to perform all these operations without any "Token 'admin' is invalid" errors. 