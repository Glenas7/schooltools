// Core contexts exports
export { AuthProvider, useAuth } from './AuthContext';
export { SchoolProvider, useSchool } from './SchoolContext';
export { SchoolsProvider, useSchools } from './SchoolsContext';

// Export types
export type { SchoolWithRole, User, UserRole, School } from '../types';

import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

// Function to sync school data across different modules/contexts
export const syncSchoolAcrossApps = (school: any) => {
  try {
    console.log('Syncing school across applications:', school?.name || school?.id);
    
    // In the current single-domain architecture, this mainly involves:
    // 1. Updating localStorage for persistence
    // 2. Triggering context refreshes if needed
    
    if (school) {
      // Store the current school selection for persistence
      localStorage.setItem('last_selected_school', school.id);
      localStorage.setItem('last_selected_school_data', JSON.stringify({
        id: school.id,
        name: school.name,
        slug: school.slug,
        userRole: school.userRole,
        syncedAt: new Date().toISOString()
      }));
      
      // Dispatch a custom event that other modules can listen to
      const syncEvent = new CustomEvent('schoolSync', {
        detail: {
          school,
          timestamp: new Date().toISOString()
        }
      });
      
      window.dispatchEvent(syncEvent);
      
      console.log('✅ School synced successfully across applications');
    } else {
      console.warn('⚠️ No school data provided for sync');
    }
  } catch (error) {
    console.error('❌ Error syncing school across applications:', error);
  }
};

export const useModules = () => {
  const { user } = useAuth();

  const getUserModulesForSchool = async (schoolId: string) => {
    if (!user) return [];

    try {
      // Use the original RPC function exactly as in commit 9ef5048
      const { data, error } = await supabase
        .rpc('get_user_modules_for_school', { target_school_id: schoolId });

      if (error) throw error;

      // Transform the data to match our expected format
      return (data || []).map((item: any) => ({
        module_id: item.module_id,
        module_name: item.module_name,
        module_display_name: item.module_display_name,
        description: '', // Not available in original RPC
        icon: item.module_icon,
        user_role: item.user_role,
        active: true // All returned results are active by definition
      }));
    } catch (error) {
      console.error('Error fetching user modules:', error);
      return [];
    }
  };

  const getModuleUsersForSchool = async (schoolId: string, moduleId: string) => {
    try {
      // First, try the join approach
      const { data: joinData, error: joinError } = await supabase
        .from('user_schools_modules')
        .select(`
          user_id,
          role,
          granted_by,
          granted_at,
          users:user_id(
            id,
            name,
            email
          )
        `)
        .eq('school_id', schoolId)
        .eq('module_id', moduleId)
        .eq('active', true);

      console.log('Join query result:', { joinData, joinError });

      if (joinError) {
        console.error('Join query error:', joinError);
        throw joinError;
      }

      // If join worked and has data with users, use it
      if (joinData && joinData.length > 0 && joinData.some(item => item.users)) {
        console.log('Using join approach - data found');
        return joinData.map(item => ({
          user_id: item.user_id,
          user_name: item.users?.name || 'Unknown User',
          user_email: item.users?.email || 'unknown@example.com',
          user_role: item.role,
          granted_by: item.granted_by,
          granted_at: item.granted_at
        }));
      }

      // If join didn't work or returned empty users, try separate queries
      console.log('Join approach failed or returned empty users, trying separate queries');
      
      // Get module users first
      const { data: moduleUsers, error: moduleError } = await supabase
        .from('user_schools_modules')
        .select('user_id, role, granted_by, granted_at')
        .eq('school_id', schoolId)
        .eq('module_id', moduleId)
        .eq('active', true);

      if (moduleError) throw moduleError;
      
      console.log('Module users without join:', moduleUsers);

      if (!moduleUsers || moduleUsers.length === 0) {
        console.log('No module users found');
        return [];
      }

      // Get user details separately
      const userIds = moduleUsers.map(mu => mu.user_id);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) {
        console.error('Users query error:', usersError);
        // Continue with unknown users rather than failing
      }

      console.log('Users data:', users);

      // Combine the data
      return moduleUsers.map(moduleUser => {
        const userData = users?.find(u => u.id === moduleUser.user_id);
        return {
          user_id: moduleUser.user_id,
          user_name: userData?.name || 'Unknown User',
          user_email: userData?.email || 'unknown@example.com',
          user_role: moduleUser.role,
          granted_by: moduleUser.granted_by,
          granted_at: moduleUser.granted_at
        };
      });

    } catch (error) {
      console.error('Error fetching module users:', error);
      return [];
    }
  };

  const grantModuleAccess = async (userId: string, schoolId: string, moduleId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_schools_modules')
        .upsert({
          user_id: userId,
          school_id: schoolId,
          module_id: moduleId,
          role,
          active: true,
          granted_by: user?.id,
          granted_at: new Date().toISOString()
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error granting module access:', error);
      return { success: false };
    }
  };

  const revokeModuleAccess = async (userId: string, schoolId: string, moduleId: string) => {
    try {
      const { error } = await supabase
        .from('user_schools_modules')
        .update({ active: false })
        .eq('user_id', userId)
        .eq('school_id', schoolId)
        .eq('module_id', moduleId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error revoking module access:', error);
      return { success: false };
    }
  };

  return {
  modules: [],
  loading: false,
  error: null,
    getUserModulesForSchool,
    getModuleUsersForSchool,
    grantModuleAccess,
    revokeModuleAccess,
  };
};