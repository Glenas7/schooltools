// Follow Deno and Oak conventions for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Type definition for user creation request
type CreateUserRequest = {
  email: string;
  name: string;
  school_id: string;
  role: 'admin' | 'teacher' | 'superadmin';
  subjectIds?: string[];
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

    // Additional permission check: Role-based user creation restrictions
    if (userData.role === 'admin' || userData.role === 'superadmin') {
      if (userSchool.role === 'admin') {
        // Admins can only create other admin users, not superadmins
        if (userData.role === 'superadmin') {
          console.error('[Edge Function] Admin cannot create superadmin users:', {
            requestingUserRole: userSchool.role,
            targetRole: userData.role
          });
          return new Response(
            JSON.stringify({ error: 'Admin users cannot create super admin users' }),
            { headers, status: 403 }
          );
        }
      } else if (userSchool.role !== 'superadmin') {
        // Non-admin/non-superadmin users cannot create admin or superadmin users
        console.error('[Edge Function] Super admin access required for creating admin users:', {
          requestingUserRole: userSchool.role,
          targetRole: userData.role
        });
        return new Response(
          JSON.stringify({ error: 'Admin access required to create admin users' }),
          { headers, status: 403 }
        );
      }
    }

    console.log('[Edge Function] Permission check passed. User can create role:', userData.role);

    // Check if user already exists by email
    console.log('[Edge Function] Checking if user already exists:', userData.email);
    const { data: existingUsers, error: existingUserError } = await supabase
      .from('users')
      .select('id, email, name, active')
      .eq('email', userData.email)
      .limit(1);

    console.log('[Edge Function] Existing user check result:', { existingUsers, existingUserError });

    let userId: string;
    let isNewUser = false;
    let membershipHandled = false; // Track if we already handled membership (reactivation)

    if (existingUserError) {
      console.error('[Edge Function] Error checking for existing user:', existingUserError);
      throw new Error(`Failed to check for existing user: ${existingUserError.message}`);
    }

    if (existingUsers && existingUsers.length > 0) {
      // User already exists
      const existingUser = existingUsers[0];
      console.log('[Edge Function] User already exists:', existingUser.id);
      
      if (!existingUser.active) {
        console.error('[Edge Function] Cannot add inactive user to school');
        return new Response(
          JSON.stringify({ error: 'Cannot add inactive user to school' }),
          { headers, status: 400 }
        );
      }

      // Check if user is already a member of this school
      const { data: existingMembership, error: membershipError } = await supabase
        .from('user_schools')
        .select('role, active')
        .eq('user_id', existingUser.id)
        .eq('school_id', userData.school_id)
        .limit(1);

      if (membershipError) {
        console.error('[Edge Function] Error checking existing membership:', membershipError);
        throw new Error(`Failed to check existing membership: ${membershipError.message}`);
      }

      if (existingMembership && existingMembership.length > 0) {
        const membership = existingMembership[0];
        if (membership.active) {
          console.error('[Edge Function] User is already an active member of this school');
          return new Response(
            JSON.stringify({ error: `User is already a ${membership.role} in this school` }),
            { headers, status: 409 }
          );
        } else {
          // Reactivate inactive membership with new role
          console.log('[Edge Function] Reactivating inactive membership with new role');
          const { error: updateError } = await supabase
            .from('user_schools')
            .update({ role: userData.role, active: true })
            .eq('user_id', existingUser.id)
            .eq('school_id', userData.school_id);

          if (updateError) {
            console.error('[Edge Function] Error reactivating membership:', updateError);
            throw new Error(`Failed to reactivate membership: ${updateError.message}`);
          }

          userId = existingUser.id;
          membershipHandled = true; // We already handled the membership
        }
      } else {
        // User exists but not in this school - we'll add them below
        userId = existingUser.id;
      }
    } else {
      // User doesn't exist, create new user
      isNewUser = true;
      console.log('[Edge Function] Creating new user with auth.admin.createUser...');
      
      try {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userData.email,
          email_confirm: true,
          user_metadata: {
            name: userData.name
          }
        });

        console.log('[Edge Function] User creation result:', { newUser: !!newUser, createError });

        if (createError) {
          // Check if the error is because user already exists in auth but not in our users table
          if (createError.message && createError.message.includes('already exists')) {
            console.log('[Edge Function] User exists in auth but not in users table, fetching auth user...');
            
            // Get the user from auth
            const { data: authUsers, error: authUserError } = await supabase.auth.admin.listUsers();
            if (authUserError) {
              console.error('[Edge Function] Error fetching auth users:', authUserError);
              throw new Error(`Failed to fetch auth users: ${authUserError.message}`);
            }
            
            const authUser = authUsers.users.find(u => u.email === userData.email);
            if (!authUser) {
              console.error('[Edge Function] Could not find auth user despite existing error');
              throw new Error('User creation failed - inconsistent auth state');
            }
            
            console.log('[Edge Function] Found auth user:', authUser.id);
            userId = authUser.id;
            
            // Insert into users table since they exist in auth but not in our table
            console.log('[Edge Function] Inserting auth user into users table...');
            const { error: userInsertError } = await supabase
              .from('users')
              .insert({
                id: authUser.id,
                name: userData.name,
                email: userData.email,
                active: true
              });

            if (userInsertError) {
              console.error('[Edge Function] Error inserting auth user:', userInsertError);
              throw new Error(`Failed to create user profile: ${userInsertError.message}`);
            }

            console.log('[Edge Function] Auth user profile created successfully');
          } else {
            console.error('[Edge Function] User creation failed:', createError);
            throw new Error(`Failed to create user: ${createError.message}`);
          }
        } else {
          if (!newUser.user) {
            console.error('[Edge Function] User creation failed - no user returned');
            throw new Error('User creation failed - no user returned');
          }

          console.log('[Edge Function] User created successfully:', newUser.user.id);
          userId = newUser.user.id;

          // Insert into users table for new users only
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
        }
      } catch (authError) {
        console.error('[Edge Function] Exception during user creation:', authError);
        throw authError;
      }
    }

    // Add user to school (only if membership wasn't already handled via reactivation)
    if (!membershipHandled) {
      console.log('[Edge Function] Adding user to school...');
      const { error: userSchoolInsertError } = await supabase
        .from('user_schools')
        .insert({
          user_id: userId,
          school_id: userData.school_id,
          role: userData.role,
          active: true
        });

      if (userSchoolInsertError) {
        console.error('[Edge Function] Error adding user to school:', userSchoolInsertError);
        throw new Error(`Failed to add user to school: ${userSchoolInsertError.message}`);
      }

      console.log('[Edge Function] User added to school successfully');
    }

    // If this is a teacher and subjectIds are provided, add subject assignments
    if (userData.role === 'teacher' && userData.subjectIds && userData.subjectIds.length > 0) {
      console.log('[Edge Function] Adding subject assignments:', userData.subjectIds);
      const subjectAssignments = userData.subjectIds.map(subjectId => ({
        teacher_id: userId,
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
      id: userId,
      name: isNewUser ? userData.name : (existingUsers?.[0]?.name || userData.name),
      email: userData.email,
      active: true,
      role: userData.role,
      subject_ids: userData.subjectIds || []
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