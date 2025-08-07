import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/core/lib/supabaseClient';
import { School, SchoolWithRole, SchoolsContextType, CreateSchoolData, UserRole } from '../types';
import { useAuth } from './AuthContext';

const SchoolsContext = createContext<SchoolsContextType | undefined>(undefined);

export const SchoolsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [schools, setSchools] = useState<SchoolWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  const fetchSchools = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setSchools([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use new RPC to get all schools where user has any access (school-level or module-level)
      const { data, error: fetchError } = await supabase
        .rpc('get_user_accessible_schools', { target_user_id: user.id });

      if (fetchError) {
        throw fetchError;
      }

      console.log('User accessible schools:', data);

      const schoolsWithRoles: SchoolWithRole[] = await Promise.all(data?.map(async item => {
        // Transform the RPC result to match our expected format
        const school: School = {
          id: item.school_id,
          name: item.school_name,
          description: item.school_description,
          slug: item.school_slug,
          active: item.school_active,
          deleted: item.school_deleted,
          created_at: item.school_created_at,
          updated_at: item.school_updated_at,
          google_sheet_url: item.school_google_sheet_url
        };
        const role = item.user_role as UserRole;
        
        // Note: item.access_type indicates whether access is from 'school' or 'module' level
        console.log(`School ${school.name}: role=${role}, access_type=${item.access_type}`);
        
        // Get enabled modules for this school first
        const { data: enabledModules, error: enabledError } = await supabase
          .rpc('get_school_enabled_modules', { target_school_id: school.id });
        
        let schoolModules: any[] = [];
        if (!enabledError && enabledModules) {
          // Get user modules for the school
          const { data: userModules, error: userModulesError } = await supabase
            .rpc('get_user_modules_for_school', { target_school_id: school.id });
          
          if (!userModulesError && userModules) {
            // Filter to only include modules that are enabled for the school
            const enabledModuleIds = new Set(enabledModules.map((em: any) => em.module_id));
            schoolModules = userModules.filter((module: any) => 
              enabledModuleIds.has(module.module_id)
            ).map((module: any) => ({
              id: module.module_id,
              module_id: module.module_id,
              module_name: module.module_name,
              display_name: module.module_display_name,
              module_display_name: module.module_display_name,
              description: module.description || '',
              icon: module.module_icon,
              module_icon: module.module_icon,
              active: true,
              user_role: module.user_role
            }));
          }
        }
        
        return {
          ...school,
          role,
          userRole: role, // Alias for backward compatibility
          modules: schoolModules,
          accessType: item.access_type // Add access type for Manage button logic
        };
      }) || []);

      setSchools(schoolsWithRoles);
    } catch (err) {
      console.error('[SchoolsContext] Exception fetching schools:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch schools');
      setSchools([]); // Ensure schools array is set even on error
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, supabase]); // Dependencies for useCallback

  const createSchool = async (schoolData: CreateSchoolData): Promise<School> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Create the school
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert([schoolData])
        .select()
        .single();

      if (schoolError) {
        throw schoolError;
      }

      // Note: User is automatically added as superadmin via the handle_school_created trigger

      // Refresh schools list
      await fetchSchools();

      return school;
    } catch (err) {
      console.error('Error creating school:', err);
      throw err;
    }
  };

  const updateSchool = async (id: string, updates: Partial<School>) => {
    try {
      const { error } = await supabase
        .from('schools')
        .update(updates)
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Refresh schools list
      await fetchSchools();
    } catch (err) {
      console.error('Error updating school:', err);
      throw err;
    }
  };

  const deleteSchool = async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const { error } = await supabase
        .from('schools')
        .update({ active: false })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Refresh schools list
      await fetchSchools();
      return { success: true, message: 'School deleted successfully' };
    } catch (err) {
      console.error('Error deleting school:', err);
      return { success: false, message: err instanceof Error ? err.message : 'Failed to delete school' };
    }
  };

  const canDeleteSchool = async (schoolId: string): Promise<boolean> => {
    // Check if user is admin for this school
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .from('user_schools')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .eq('active', true)
        .single();

      if (error || !data) return false;
      
      return data.role === 'admin' || data.role === 'superadmin';
    } catch (err) {
      console.error('Error checking delete permission:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]); // Now depends on the stable useCallback function

  const value: SchoolsContextType = {
    schools,
    loading,
    error,
    refreshSchools: fetchSchools,
    createSchool,
    updateSchool,
    deleteSchool,
    fetchUserSchools: async () => {

      return fetchSchools();
    }, // Alias for backward compatibility
    canDeleteSchool,
  };

  return <SchoolsContext.Provider value={value}>{children}</SchoolsContext.Provider>;
};

export const useSchools = (): SchoolsContextType => {
  const context = useContext(SchoolsContext);
  if (context === undefined) {
    throw new Error('useSchools must be used within a SchoolsProvider');
  }
  return context;
};