import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { School, CreateSchoolData, SchoolWithRole, UserRole, SchoolsContextType, UserModulePermission } from '../types';
import { useAuth } from '../auth/AuthProvider';

interface SchoolsProviderProps {
  children: React.ReactNode;
  supabaseClient: any; // Will be injected by the app using this package
}

const SchoolsContext = createContext<SchoolsContextType | undefined>(undefined);

export const SchoolsProvider: React.FC<SchoolsProviderProps> = ({ children, supabaseClient }) => {
  const [schools, setSchools] = useState<SchoolWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user, isAuthenticated } = useAuth();

  const fetchUserSchools = useCallback(async () => {
    console.log('[SchoolsContext] fetchUserSchools called. isAuthenticated:', isAuthenticated, 'user:', user?.id);
    
    if (!isAuthenticated || !user) {
      console.log('[SchoolsContext] Not authenticated or no user, setting empty schools');
      setSchools([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[SchoolsContext] Fetching all user school access (school-level + module-level) for user:', user.id);
      
      // Use enhanced function that gets ALL schools where user has access (school-level OR module-level)
      const { data: userSchoolAccess, error: userSchoolAccessError } = await supabaseClient
        .rpc('get_user_school_ids_enhanced');

      if (userSchoolAccessError) throw userSchoolAccessError;

      console.log('[SchoolsContext] Enhanced school access query result:', userSchoolAccess?.length || 0, 'access records');

      if (!userSchoolAccess || userSchoolAccess.length === 0) {
        console.log('[SchoolsContext] No school access found (neither school-level nor module-level), setting empty schools');
        setSchools([]);
        setLoading(false);
        return;
      }

      // Get unique school IDs and organize access information
      const schoolAccessMap = new Map();
      userSchoolAccess.forEach((access: any) => {
        if (!schoolAccessMap.has(access.school_id)) {
          schoolAccessMap.set(access.school_id, {
            school_id: access.school_id,
            school_access: null,
            module_access: []
          });
        }
        
        const schoolAccess = schoolAccessMap.get(access.school_id);
        if (access.access_type === 'school') {
          schoolAccess.school_access = { role: access.role };
        } else if (access.access_type === 'module') {
          schoolAccess.module_access.push({ role: access.role });
        }
      });

      const schoolIds = Array.from(schoolAccessMap.keys());
      console.log('[SchoolsContext] Fetching school details for IDs:', schoolIds);
      
      const { data: schoolsData, error: schoolsError } = await supabaseClient
        .from('schools')
        .select('id, name, description, slug, google_sheet_url, settings, active, deleted, created_at, updated_at')
        .in('id', schoolIds)
        .eq('active', true)
        .eq('deleted', false);

      if (schoolsError) throw schoolsError;

      console.log('[SchoolsContext] Schools query result:', schoolsData?.length || 0, 'schools');

      // Fetch module permissions for each school
      const schoolsWithRolesAndModules: SchoolWithRole[] = [];
      
      for (const school of schoolsData || []) {
        const accessInfo = schoolAccessMap.get(school.id);
        
        // Determine the primary user role (prefer school-level role, fallback to highest module role)
        let userRole: UserRole = 'teacher'; // default
        let is_superadmin = false;

        if (accessInfo.school_access) {
          // User has school-level access
          userRole = accessInfo.school_access.role as UserRole;
          is_superadmin = userRole === 'superadmin';
        } else if (accessInfo.module_access.length > 0) {
          // User only has module-level access, use the highest role
          const roles = accessInfo.module_access.map((ma: any) => ma.role);
          if (roles.includes('superadmin')) {
            userRole = 'superadmin';
          } else if (roles.includes('admin')) {
            userRole = 'admin';
          } else {
            userRole = 'teacher';
          }
        }
        
        // Fetch user's modules for this school (only enabled modules)
        let modules: UserModulePermission[] = [];
        try {
          // First get enabled modules for this school
          const { data: enabledModules, error: enabledError } = await supabaseClient
            .rpc('get_school_enabled_modules', { target_school_id: school.id });
          
          if (enabledError) throw enabledError;
          
          // Then get user's access to these modules
          const { data: moduleData, error: moduleError } = await supabaseClient
            .rpc('get_user_modules_for_school', { target_school_id: school.id });
          
          if (!moduleError && moduleData && enabledModules) {
            // Filter to only include modules that are enabled for the school
            const enabledModuleIds = enabledModules.map((em: any) => em.module_id);
            const userEnabledModules = moduleData.filter((mod: any) => 
              enabledModuleIds.includes(mod.module_id)
            );
            
            modules = userEnabledModules.map((mod: any) => ({
              module_id: mod.module_id,
              module_name: mod.module_name,
              module_display_name: mod.module_display_name,
              module_icon: mod.module_icon,
              module_subdomain: mod.module_subdomain,
              user_role: mod.user_role,
              role_hierarchy: mod.role_hierarchy
            }));
          }
        } catch (e) {
          console.warn('[SchoolsContext] Failed to fetch modules for school:', school.id, e);
        }

        schoolsWithRolesAndModules.push({
          ...school,
          userRole,
          is_superadmin,
          modules
        });
      }

      console.log('[SchoolsContext] Final schools with enhanced access (school + module):', schoolsWithRolesAndModules.length, 'schools');
      setSchools(schoolsWithRolesAndModules);
    } catch (e) {
      console.error('[SchoolsContext] Error fetching schools:', e);
      setError(e as Error);
      setSchools([]);
    }
    setLoading(false);
  }, [user, isAuthenticated, supabaseClient]);

  // Auto-load schools when user authenticates
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[SchoolsContext] User authenticated, auto-loading schools');
      fetchUserSchools();
    } else {
      console.log('[SchoolsContext] User not authenticated, clearing schools');
      setSchools([]);
    }
  }, [isAuthenticated, user, fetchUserSchools]);

  const createSchool = async (schoolData: CreateSchoolData): Promise<School | null> => {
    if (!user) {
      setError(new Error('User not authenticated'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Check current session to ensure user is properly authenticated
      let { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (sessionError || !session) {
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = await supabaseClient.auth.refreshSession();
        
        if (refreshError || !refreshedSession) {
          throw new Error('Authentication session expired. Please log in again.');
        }
        
        session = refreshedSession;
      }

      // Ensure the session is properly set on the Supabase client
      const { error: setSessionError } = await supabaseClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
      
      if (setSessionError) {
        console.error('Error setting session on client:', setSessionError);
        throw new Error('Failed to authenticate with server. Please try again.');
      }

      const { data, error: createError } = await supabaseClient
        .from('schools')
        .insert({
          name: schoolData.name,
          description: schoolData.description,
          google_sheet_url: schoolData.google_sheet_url,
          active: true
        })
        .select()
        .single();

      if (createError) throw createError;

      const newSchool = data as School;

      // Note: The user_schools record is automatically created by the 'on_school_created' trigger
      // which runs the 'handle_school_created' function and adds the creator as a superadmin

      // Wait a moment for the trigger to complete and verify the user was added
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: membership, error: membershipCheckError } = await supabaseClient
        .from('user_schools')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('school_id', newSchool.id)
        .eq('active', true)
        .single();

      if (membershipCheckError || !membership) {
        console.error('School creation trigger failed to create membership:', membershipCheckError);
        // Clean up the school since the membership wasn't created
        await supabaseClient.from('schools').delete().eq('id', newSchool.id);
        throw new Error('Failed to set up school membership. Please try again.');
      }

      console.log('School created successfully with role:', membership.role);

      // Refresh user's schools list
      await fetchUserSchools();

      return newSchool;
    } catch (e) {
      console.error('Error creating school:', e);
      setError(e as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateSchool = async (schoolId: string, updates: Partial<School>): Promise<School | null> => {
    if (!user) {
      setError(new Error('User not authenticated'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if user is admin of this school
      const { data: userSchoolData, error: userSchoolError } = await supabaseClient
        .from('user_schools')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .eq('active', true)
        .single();

      if (userSchoolError || !userSchoolData) {
        throw new Error('You do not have access to this school');
      }

      if (userSchoolData.role !== 'admin' && userSchoolData.role !== 'superadmin') {
        throw new Error('You do not have permission to update this school');
      }

      // Update the school
      const { data: updatedSchool, error: updateError } = await supabaseClient
        .from('schools')
        .update(updates)
        .eq('id', schoolId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Refresh user's schools list to reflect changes
      await fetchUserSchools();

      return updatedSchool;
    } catch (e) {
      console.error('Error updating school:', e);
      setError(e as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteSchool = async (schoolId: string): Promise<boolean> => {
    if (!user) {
      setError(new Error('User not authenticated'));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if user can delete this school (must be admin)
      const canDelete = await canDeleteSchool(schoolId);
      if (!canDelete) {
        throw new Error('You do not have permission to delete this school');
      }

      // Soft delete the school and set slug to UUID to free up the human-readable slug
      const { error: deleteError } = await supabaseClient
        .from('schools')
        .update({ deleted: true, active: false, slug: schoolId })
        .eq('id', schoolId);

      if (deleteError) throw deleteError;

      // Refresh user's schools list
      await fetchUserSchools();

      return true;
    } catch (e) {
      console.error('Error deleting school:', e);
      setError(e as Error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const canDeleteSchool = async (schoolId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Check if user is admin of this school
      const { data: userSchoolData, error } = await supabaseClient
        .from('user_schools')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .eq('active', true)
        .single();

      if (error || !userSchoolData) return false;

      return userSchoolData.role === 'admin' || userSchoolData.role === 'superadmin';
    } catch (e) {
      console.error('Error checking delete permission:', e);
      return false;
    }
  };

  return (
    <SchoolsContext.Provider value={{
      schools,
      loading,
      error,
      fetchUserSchools,
      createSchool,
      updateSchool,
      deleteSchool,
      canDeleteSchool
    }}>
      {children}
    </SchoolsContext.Provider>
  );
};

export const useSchools = () => {
  const context = useContext(SchoolsContext);
  if (context === undefined) {
    throw new Error('useSchools must be used within a SchoolsProvider');
  }
  return context;
};

export default SchoolsProvider; 