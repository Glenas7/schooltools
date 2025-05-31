// Follow Deno and Oak conventions for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Type definition for user creation request
type CreateUserRequest = {
  email: string;
  name: string;
  school_id: string;
  role: 'admin' | 'teacher';
  subject_ids?: string[];
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Create the Supabase client with service role
const createSupabaseClient = (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
};

serve(async (req: Request) => {
  console.log('[Edge Function] create-user called with method:', req.method);
  console.log('[Edge Function] Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[Edge Function] Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[Edge Function] Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[Edge Function] No authorization header found');
      throw new Error('No authorization header');
    }
    
    // Create Supabase client to validate auth
    const supabase = createSupabaseClient(req);
    console.log('[Edge Function] Supabase client created successfully');
    
    // Verify that the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[Edge Function] Auth check result:', { user: !!user, authError: !!authError });
    
    if (authError || !user) {
      console.error('[Edge Function] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers, status: 401 }
      );
    }
    
    console.log('[Edge Function] User authenticated successfully:', user.id);
    
    // Get user creation data from request body with better error handling
    let userData: CreateUserRequest;
    try {
      console.log('[Edge Function] Reading request body...');
      const body = await req.text();
      console.log('[Edge Function] Raw request body length:', body.length);
      console.log('[Edge Function] Raw request body:', body);
      
      if (!body || body.trim() === '') {
        console.error('[Edge Function] Request body is empty or null');
        throw new Error('Request body is empty');
      }
      
      console.log('[Edge Function] Attempting to parse JSON...');
      userData = JSON.parse(body);
      console.log('[Edge Function] Parsed user data successfully:', userData);
    } catch (parseError) {
      console.error('[Edge Function] JSON parsing error:', parseError);
      console.error('[Edge Function] Parse error details:', {
        message: parseError.message,
        stack: parseError.stack
      });
      return new Response(
        JSON.stringify({ error: `Invalid JSON in request body: ${parseError.message}` }),
        { headers, status: 400 }
      );
    }
    
    console.log('[Edge Function] Validating required fields...');
    if (!userData.email || !userData.name || !userData.school_id || !userData.role) {
      console.error('[Edge Function] Missing required fields:', {
        email: !!userData.email,
        name: !!userData.name,
        school_id: !!userData.school_id,
        role: !!userData.role
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, name, school_id, role' }),
        { headers, status: 400 }
      );
    }

    console.log('[Edge Function] Checking user admin permissions for school:', userData.school_id);
    // Verify the requesting user is an admin of the target school
    const { data: userSchool, error: userSchoolError } = await supabase
      .from('user_schools')
      .select('role')
      .eq('user_id', user.id)
      .eq('school_id', userData.school_id)
      .eq('active', true)
      .single();

    console.log('[Edge Function] User school check result:', { userSchool, userSchoolError });

    if (userSchoolError || !userSchool || (userSchool.role !== 'admin' && userSchool.role !== 'superadmin')) {
      console.error('[Edge Function] Admin access denied:', {
        userSchoolError,
        userSchool,
        userRole: userSchool?.role
      });
      return new Response(
        JSON.stringify({ error: 'Admin access required for this school' }),
        { headers, status: 403 }
      );
    }

    console.log('[Edge Function] Creating new user with auth.admin.createUser...');
    // Create the user using service role
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
      user_metadata: {
        name: userData.name
      }
    });

    console.log('[Edge Function] User creation result:', { newUser: !!newUser, createError });

    if (createError) {
      console.error('[Edge Function] User creation failed:', createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser.user) {
      console.error('[Edge Function] User creation failed - no user returned');
      throw new Error('User creation failed - no user returned');
    }

    console.log('[Edge Function] User created successfully:', newUser.user.id);

    // Insert into users table
    console.log('[Edge Function] Inserting user into users table...');
    const { error: userInsertError } = await supabase
      .from('users')
      .insert({
        id: newUser.user.id,
        name: userData.name,
        email: userData.email,
        active: true
      });

    if (userInsertError) {
      console.error('[Edge Function] Error inserting user:', userInsertError);
      throw new Error(`Failed to create user profile: ${userInsertError.message}`);
    }

    console.log('[Edge Function] User profile created successfully');

    // Add user to school
    console.log('[Edge Function] Adding user to school...');
    const { error: userSchoolInsertError } = await supabase
      .from('user_schools')
      .insert({
        user_id: newUser.user.id,
        school_id: userData.school_id,
        role: userData.role,
        active: true
      });

    if (userSchoolInsertError) {
      console.error('[Edge Function] Error adding user to school:', userSchoolInsertError);
      throw new Error(`Failed to add user to school: ${userSchoolInsertError.message}`);
    }

    console.log('[Edge Function] User added to school successfully');

    // If this is a teacher and subject_ids are provided, add subject assignments
    if (userData.role === 'teacher' && userData.subject_ids && userData.subject_ids.length > 0) {
      console.log('[Edge Function] Adding subject assignments:', userData.subject_ids);
      const subjectAssignments = userData.subject_ids.map(subjectId => ({
        teacher_id: newUser.user.id,
        subject_id: subjectId,
        school_id: userData.school_id
      }));

      const { error: subjectAssignmentError } = await supabase
        .from('teachers_subjects')
        .insert(subjectAssignments);

      if (subjectAssignmentError) {
        console.error('[Edge Function] Error assigning subjects:', subjectAssignmentError);
        // Don't throw here - user is created, just subject assignment failed
      } else {
        console.log('[Edge Function] Subject assignments created successfully');
      }
    }

    // Return the created user data
    const responseData = {
      id: newUser.user.id,
      name: userData.name,
      email: userData.email,
      active: true,
      role: userData.role,
      subject_ids: userData.subject_ids || []
    };

    console.log('[Edge Function] Returning success response:', responseData);
    return new Response(JSON.stringify(responseData), { 
      headers,
      status: 200 
    });

  } catch (error) {
    console.error('[Edge Function] Error in create-user function:', error);
    console.error('[Edge Function] Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { headers, status: 500 }
    );
  }
}); 