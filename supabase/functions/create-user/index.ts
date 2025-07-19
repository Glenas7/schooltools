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
  module_name?: string; // Optional: if provided, grant access to specific module
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Create the Supabase client with user auth for permission checks
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

// Create admin Supabase client for auth operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  return createClient(supabaseUrl, supabaseKey, {
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

    // Use admin client for all database operations
    const adminSupabase = createAdminSupabaseClient();

    let userId: string;
    let userWasCreated = false;

    // Step 1: Try to find existing user in our users table
    console.log('[Edge Function] Checking if user already exists in users table:', userData.email);
    const { data: existingUsers, error: existingUserError } = await adminSupabase
      .from('users')
      .select('id, email, name, active')
      .eq('email', userData.email)
      .limit(1);

    console.log('[Edge Function] Existing user check result:', { existingUsers, existingUserError });

    if (existingUserError) {
      console.error('[Edge Function] Error checking for existing user:', existingUserError);
      throw new Error(`Failed to check for existing user: ${existingUserError.message}`);
    }

    if (existingUsers && existingUsers.length > 0) {
      // User already exists in our users table
      const existingUser = existingUsers[0];
      console.log('[Edge Function] User already exists in users table, using existing ID:', existingUser.id);
      
      if (!existingUser.active) {
        console.error('[Edge Function] Cannot add inactive user to school');
        return new Response(
          JSON.stringify({ error: 'Cannot add inactive user to school' }),
          { headers, status: 400 }
        );
      }

      userId = existingUser.id;
      // Update name if it's different (in case user wants to update it)
      if (existingUser.name !== userData.name) {
        console.log('[Edge Function] Updating user name from', existingUser.name, 'to', userData.name);
        const { error: updateError } = await adminSupabase
          .from('users')
          .update({ name: userData.name })
          .eq('id', existingUser.id);
        
        if (updateError) {
          console.warn('[Edge Function] Failed to update user name:', updateError);
        }
      }
    } else {
      // User doesn't exist in our users table, check auth and handle creation
      console.log('[Edge Function] User not found in users table, checking auth and creating if necessary...');
      
      try {
        // Check if user exists in auth
        const { data: authUsers, error: authUserError } = await adminSupabase.auth.admin.listUsers();
        if (authUserError) {
          console.error('[Edge Function] Error fetching auth users:', authUserError);
          throw new Error(`Failed to fetch auth users: ${authUserError.message}`);
        }
        
        const existingAuthUser = authUsers.users.find(u => u.email === userData.email);
        
        if (existingAuthUser) {
          // User exists in auth but not in our users table
          console.log('[Edge Function] User exists in auth but not in users table, adding to users table:', existingAuthUser.id);
          userId = existingAuthUser.id;
        } else {
          // User doesn't exist anywhere - create new user in auth
          userWasCreated = true;
          console.log('[Edge Function] User does not exist anywhere, creating new user...');
          
          const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
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
          userId = newUser.user.id;
        }

        // Now insert/upsert into users table using upsert to handle race conditions
        console.log('[Edge Function] Upserting user into users table...');
        const { error: userUpsertError } = await adminSupabase
          .from('users')
          .upsert({
            id: userId,
            name: userData.name,
            email: userData.email,
            active: true
          }, {
            onConflict: 'email'
          });

        if (userUpsertError) {
          console.error('[Edge Function] Error upserting user:', userUpsertError);
          throw new Error(`Failed to create user profile: ${userUpsertError.message}`);
        }
        
        console.log('[Edge Function] User successfully upserted into users table');
      } catch (error) {
        console.error('[Edge Function] Error in user creation process:', error);
        throw error;
      }
    }

    // Handle school membership (create or update)
    let schoolMembershipChanged = false;
    if (!userData.module_name && userData.role === 'superadmin') {
      // Only school-level superadmins (without module_name) go into user_schools table
      console.log('[Edge Function] Handling school-level superadmin membership...');
      const { data: existingMembership, error: membershipError } = await supabase
        .from('user_schools')
        .select('role, active')
        .eq('user_id', userId)
        .eq('school_id', userData.school_id)
        .limit(1);

      if (membershipError) {
        console.error('[Edge Function] Error checking existing membership:', membershipError);
        throw new Error(`Failed to check existing membership: ${membershipError.message}`);
      }

      if (existingMembership && existingMembership.length > 0) {
        const membership = existingMembership[0];
        if (membership.active) {
          // User is already active in school
          if (membership.role !== userData.role) {
            // Update role if different
            console.log(`[Edge Function] Updating user role from ${membership.role} to ${userData.role}`);
            const { error: updateError } = await supabase
              .from('user_schools')
              .update({ role: userData.role })
              .eq('user_id', userId)
              .eq('school_id', userData.school_id);

            if (updateError) {
              console.error('[Edge Function] Error updating membership role:', updateError);
              throw new Error(`Failed to update membership role: ${updateError.message}`);
            }
            schoolMembershipChanged = true;
          } else {
            console.log('[Edge Function] User already has correct role in school');
          }
        } else {
          // Reactivate inactive membership with new role
          console.log('[Edge Function] Reactivating inactive membership with role:', userData.role);
          const { error: updateError } = await supabase
            .from('user_schools')
            .update({ role: userData.role, active: true })
            .eq('user_id', userId)
            .eq('school_id', userData.school_id);

          if (updateError) {
            console.error('[Edge Function] Error reactivating membership:', updateError);
            throw new Error(`Failed to reactivating membership: ${updateError.message}`);
          }
          schoolMembershipChanged = true;
        }
      } else {
        // User is not in school, add them
        console.log('[Edge Function] Adding superadmin to school...');
        const { error: userSchoolInsertError } = await supabase
          .from('user_schools')
          .upsert({
            user_id: userId,
            school_id: userData.school_id,
            role: userData.role,
            active: true
          }, {
            onConflict: 'user_id,school_id'
          });

        if (userSchoolInsertError) {
          console.error('[Edge Function] Error adding user to school:', userSchoolInsertError);
          throw new Error(`Failed to add user to school: ${userSchoolInsertError.message}`);
        }
        schoolMembershipChanged = true;
        console.log('[Edge Function] Superadmin added to school successfully');
      }
    } else {
      console.log('[Edge Function] Skipping user_schools table - this is a module-level addition');
    }

    // Handle module access if module_name is provided
    let moduleAccessGranted = false;
    if (userData.module_name) {
      console.log('[Edge Function] Handling module access for:', userData.module_name);
      
      // Get module ID
      const { data: module, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .eq('name', userData.module_name)
        .single();

      if (moduleError || !module) {
        console.warn('[Edge Function] Module not found:', userData.module_name);
      } else {
        // Check if user already has module access
        const { data: existingModuleAccess, error: moduleAccessError } = await supabase
          .from('user_schools_modules')
          .select('role, active')
          .eq('user_id', userId)
          .eq('school_id', userData.school_id)
          .eq('module_id', module.id)
          .limit(1);

        if (moduleAccessError) {
          console.error('[Edge Function] Error checking module access:', moduleAccessError);
        } else {
          if (existingModuleAccess && existingModuleAccess.length > 0) {
            const moduleAccess = existingModuleAccess[0];
            if (moduleAccess.active) {
              if (moduleAccess.role !== userData.role) {
                // Update module role
                console.log(`[Edge Function] Updating module role from ${moduleAccess.role} to ${userData.role}`);
                const { error: updateModuleError } = await supabase
                  .from('user_schools_modules')
                  .update({ role: userData.role })
                  .eq('user_id', userId)
                  .eq('school_id', userData.school_id)
                  .eq('module_id', module.id);

                if (updateModuleError) {
                  console.error('[Edge Function] Error updating module role:', updateModuleError);
                } else {
                  moduleAccessGranted = true;
                }
              } else {
                console.log('[Edge Function] User already has correct module access');
                moduleAccessGranted = true;
              }
            } else {
              // Reactivate module access
              console.log('[Edge Function] Reactivating module access');
              const { error: reactivateError } = await supabase
                .from('user_schools_modules')
                .update({ role: userData.role, active: true })
                .eq('user_id', userId)
                .eq('school_id', userData.school_id)
                .eq('module_id', module.id);

              if (reactivateError) {
                console.error('[Edge Function] Error reactivating module access:', reactivateError);
              } else {
                moduleAccessGranted = true;
              }
            }
          } else {
            // Grant new module access
            console.log('[Edge Function] Granting new module access');
            const { error: grantError } = await supabase
              .from('user_schools_modules')
              .upsert({
                user_id: userId,
                school_id: userData.school_id,
                module_id: module.id,
                role: userData.role,
                active: true
              }, {
                onConflict: 'user_id,school_id,module_id'
              });

            if (grantError) {
              console.error('[Edge Function] Error granting module access:', grantError);
            } else {
              moduleAccessGranted = true;
            }
          }
        }
      }
    }

    // If this is a teacher and subjectIds are provided, add subject assignments
    if (userData.role === 'teacher' && userData.subjectIds && userData.subjectIds.length > 0 && userData.module_name) {
      console.log('[Edge Function] Adding subject assignments for teacher:', userId);
      
      try {
        // Get the module ID for subject assignments
        const { data: moduleForSubjects, error: moduleForSubjectsError } = await adminSupabase
          .from('modules')
          .select('id')
          .eq('name', userData.module_name)
          .single();

        if (moduleForSubjectsError || !moduleForSubjects) {
          console.error('[Edge Function] Could not find module for subject assignments:', userData.module_name);
          return;
        }

        // First, remove any existing subject assignments for this teacher in this school/module
        // to avoid conflicts and ensure we have the exact subjects requested
        console.log('[Edge Function] Clearing existing subject assignments...');
        const { error: deleteError } = await adminSupabase
          .from('teachers_subjects')
          .delete()
          .eq('teacher_id', userId)
          .eq('school_id', userData.school_id)
          .eq('module_id', moduleForSubjects.id);

        if (deleteError) {
          console.warn('[Edge Function] Warning: Failed to clear existing subjects:', deleteError);
        }

        // Now insert the new subject assignments
        const subjectAssignments = userData.subjectIds.map(subjectId => ({
          teacher_id: userId,
          subject_id: subjectId,
          school_id: userData.school_id,
          module_id: moduleForSubjects.id
        }));

        console.log('[Edge Function] Inserting subject assignments:', subjectAssignments);
        const { error: subjectAssignmentError } = await adminSupabase
          .from('teachers_subjects')
          .insert(subjectAssignments);

        if (subjectAssignmentError) {
          console.error('[Edge Function] Subject assignment failed:', subjectAssignmentError);
          // Don't throw here, just log the error so user creation still succeeds
        } else {
          console.log('[Edge Function] Subject assignments created successfully');
        }
      } catch (subjectError) {
        console.error('[Edge Function] Exception during subject assignment:', subjectError);
        // Don't throw here, just log the error so user creation still succeeds
      }
    }

    // Return success response with detailed information
    const responseData = {
      id: userId,
      name: userData.name,
      email: userData.email,
      active: true,
      role: userData.role,
      subject_ids: userData.subjectIds || [],
      created: userWasCreated,
      school_membership_changed: schoolMembershipChanged,
      module_access_granted: moduleAccessGranted
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