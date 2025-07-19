import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { School, UserRole, SchoolContextType, UserSchool } from '../types';
import { useAuth } from '../auth/AuthProvider';

interface SchoolProviderProps {
  children: React.ReactNode;
  supabaseClient: any; // Will be injected by the app using this package
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<SchoolProviderProps> = ({ children, supabaseClient }) => {
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const params = useParams<{ schoolId?: string; schoolSlug?: string }>();

  // Resolve school slug to school ID if needed
  const resolveSchoolIdentifier = async (identifier: string, isSlug: boolean = false): Promise<string | null> => {
    if (!isSlug) {
      // If it's already a UUID, return as-is
      return identifier;
    }

    try {
      // Use the backend function to get school by slug
      const { data, error } = await supabaseClient
        .rpc('get_school_by_slug', { school_slug: identifier });

      if (error) {
        console.error('Error resolving school slug:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.warn('School not found for slug:', identifier);
        return null;
      }

      return data[0].id;
    } catch (error) {
      console.error('Exception resolving school slug:', error);
      return null;
    }
  };

  // Get user's role in the current school (enhanced for modular system)
  const fetchUserRoleInSchool = async (schoolId: string, userId: string) => {
    try {
      // First check if we're in a module context by detecting the current domain/path
      // This is a scheduler module, so check for scheduler-specific roles first
      const isSchedulerModule = window.location.port === '3001' || 
                               window.location.hostname.includes('scheduler') ||
                               window.location.pathname.includes('scheduler');

      if (isSchedulerModule) {
        // Get the scheduler module ID and check user's module-specific role
        const { data: schedulerModule, error: moduleError } = await supabaseClient
          .from('modules')
          .select('id')
          .eq('name', 'scheduler')
          .single();

        if (!moduleError && schedulerModule) {
          const { data: moduleRole, error: moduleRoleError } = await supabaseClient
            .from('user_schools_modules')
            .select('role')
            .eq('user_id', userId)
            .eq('school_id', schoolId)
            .eq('module_id', schedulerModule.id)
            .eq('active', true)
            .single();

          if (!moduleRoleError && moduleRole) {
            console.log('[DEBUG SchoolProvider] Found module-specific role:', moduleRole.role, 'for scheduler module');
            return moduleRole.role as UserRole;
          } else {
            console.log('[DEBUG SchoolProvider] No module-specific role found, falling back to school role');
          }
        }
      }

      // Fallback to the traditional user_schools role check
      const { data, error } = await supabaseClient
        .from('user_schools')
        .select('role')
        .eq('user_id', userId)
        .eq('school_id', schoolId)
        .eq('active', true)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      console.log('[DEBUG SchoolProvider] Using school-level role:', data?.role);
      return data?.role as UserRole || null;
    } catch (e) {
      console.error('Exception fetching user role:', e);
      return null;
    }
  };

  // Set current school and fetch user's role in that school
  const setCurrentSchool = async (school: School | null) => {
    setCurrentSchoolState(school);
    
    if (school && user) {
      const role = await fetchUserRoleInSchool(school.id, user.id);
      setUserRole(role);
      
      // Store in localStorage for persistence
      localStorage.setItem('currentSchoolId', school.id);
    } else {
      setUserRole(null);
      localStorage.removeItem('currentSchoolId');
    }
  };

  // Switch to a different school by ID
  const switchSchool = useCallback(async (schoolId: string) => {
    if (!user) return;
    
    try {
      // Verify user has access to this school (check both user_schools and module access)
      const { data: userSchool, error: userSchoolError } = await supabaseClient
        .from('user_schools')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .eq('active', true)
        .single();

      if (userSchoolError || !userSchool) {
        console.error('User does not have access to this school');
        return;
      }

      // Fetch the school details
      const { data: school, error: schoolError } = await supabaseClient
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .eq('active', true)
        .single();

      if (schoolError || !school) {
        console.error('School not found');
        return;
      }

      // Get the proper role using the same logic as fetchUserRoleInSchool
      const role = await fetchUserRoleInSchool(schoolId, user.id);

      setCurrentSchoolState(school as School);
      setUserRole(role);
      localStorage.setItem('currentSchoolId', schoolId);
    } catch (e) {
      console.error('Error switching school:', e);
    }
  }, [user, supabaseClient]);

  // Refresh current school data
  const refreshSchool = async () => {
    if (!currentSchool || !user) return;
    
    try {
      // Fetch updated school details
      const { data: school, error: schoolError } = await supabaseClient
        .from('schools')
        .select('*')
        .eq('id', currentSchool.id)
        .eq('active', true)
        .single();

      if (schoolError || !school) {
        console.error('Error refreshing school data');
        return;
      }

      setCurrentSchoolState(school as School);
    } catch (e) {
      console.error('Exception refreshing school:', e);
    }
  };

  // Load school based on URL parameters and localStorage
  useEffect(() => {
    console.log('[DEBUG SchoolContext] loadSchool effect triggered. isAuthenticated:', isAuthenticated, 'user:', user?.id, 'schoolId:', params.schoolId, 'schoolSlug:', params.schoolSlug);
    
    const loadSchool = async () => {
      console.log('[DEBUG SchoolContext] Starting loadSchool async function');
      
      if (!isAuthenticated || !user) {
        console.log('[DEBUG SchoolContext] Not authenticated or no user, clearing school state');
        setCurrentSchoolState(null);
        setUserRole(null);
        return;
      }

      console.log('[DEBUG SchoolContext] User is authenticated, proceeding with school loading');
      setLoading(true);

      let targetSchoolId: string | null = null;

      // Priority 1: Use schoolSlug from URL if available and resolve it
      if (params.schoolSlug) {
        console.log('[DEBUG SchoolContext] Found schoolSlug in URL, resolving:', params.schoolSlug);
        targetSchoolId = await resolveSchoolIdentifier(params.schoolSlug, true);
        if (targetSchoolId) {
          console.log('[DEBUG SchoolContext] Resolved schoolSlug to ID:', targetSchoolId);
        } else {
          console.error('[DEBUG SchoolContext] Failed to resolve schoolSlug:', params.schoolSlug);
          setCurrentSchoolState(null);
          setUserRole(null);
          setLoading(false);
          return;
        }
      }
      // Priority 2: Use schoolId from URL if available
      else if (params.schoolId) {
        targetSchoolId = params.schoolId;
        console.log('[DEBUG SchoolContext] Using URL schoolId:', targetSchoolId);
      }
      // Priority 3: Fall back to localStorage if no URL parameter
      else {
        targetSchoolId = localStorage.getItem('currentSchoolId');
        console.log('[DEBUG SchoolContext] No URL parameter, using localStorage:', targetSchoolId);
      }

      if (targetSchoolId) {
        console.log('[DEBUG SchoolContext] Loading school with ID:', targetSchoolId);
        try {
          console.log('[DEBUG SchoolContext] Step 1: Verifying user access to school');
          
          // Verify user has access to this school and get the school details
          const { data: userSchool, error: userSchoolError } = await supabaseClient
            .from('user_schools')
            .select('role')
            .eq('user_id', user.id)
            .eq('school_id', targetSchoolId)
            .eq('active', true)
            .single();

          if (userSchoolError || !userSchool) {
            console.error('[DEBUG SchoolContext] User does not have access to this school:', userSchoolError);
            setCurrentSchoolState(null);
            setUserRole(null);
            setLoading(false);
            return;
          }

          console.log('[DEBUG SchoolContext] User has access with role:', userSchool.role);

          console.log('[DEBUG SchoolContext] Step 2: Fetching school details');
          
          // Fetch the school details
          const { data: school, error: schoolError } = await supabaseClient
            .from('schools')
            .select('*')
            .eq('id', targetSchoolId)
            .eq('active', true)
            .single();

          if (schoolError || !school) {
            console.error('[DEBUG SchoolContext] School not found:', schoolError);
            setCurrentSchoolState(null);
            setUserRole(null);
            setLoading(false);
            return;
          }

          console.log('[DEBUG SchoolContext] School loaded successfully:', school.name);
          
          // Get the proper role using the enhanced role fetching logic
          const role = await fetchUserRoleInSchool(targetSchoolId, user.id);
          
          setCurrentSchoolState(school as School);
          setUserRole(role);
          localStorage.setItem('currentSchoolId', targetSchoolId);
          
        } catch (e) {
          console.error('[DEBUG SchoolContext] Error loading school:', e);
          setCurrentSchoolState(null);
          setUserRole(null);
        }
      } else {
        console.log('[DEBUG SchoolContext] No targetSchoolId found, not loading any school');
        setCurrentSchoolState(null);
        setUserRole(null);
      }
      
      setLoading(false);
    };

    loadSchool();
  }, [isAuthenticated, user?.id, params.schoolId, params.schoolSlug, supabaseClient]);

  const isSchoolAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSchoolSuperAdmin = userRole === 'superadmin';

  return (
    <SchoolContext.Provider value={{
      currentSchool,
      userRole,
      loading,
      isSchoolAdmin,
      isSchoolSuperAdmin,
      setCurrentSchool,
      switchSchool,
      refreshSchool
    }}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};

export default SchoolProvider; 