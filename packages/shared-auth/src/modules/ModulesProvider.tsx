import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Module, ModulesContextType, UserModulePermission, ModuleUser } from '../types';

interface ModulesProviderProps {
  children: React.ReactNode;
  supabaseClient: any;
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

export const ModulesProvider: React.FC<ModulesProviderProps> = ({ children, supabaseClient }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user, isAuthenticated } = useAuth();

  const fetchModules = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setModules([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabaseClient
        .rpc('get_available_modules');

      if (fetchError) throw fetchError;

      setModules(data || []);
    } catch (e) {
      console.error('Error fetching modules:', e);
      setError(e as Error);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, supabaseClient]);

  const getUserModulesForSchool = useCallback(async (schoolId: string): Promise<UserModulePermission[]> => {
    if (!isAuthenticated || !user) {
      return [];
    }

    try {
      const { data, error: fetchError } = await supabaseClient
        .rpc('get_user_modules_for_school', { target_school_id: schoolId });

      if (fetchError) throw fetchError;

      return data || [];
    } catch (e) {
      console.error('Error fetching user modules for school:', e);
      return [];
    }
  }, [user, isAuthenticated, supabaseClient]);

  const getModuleUsersForSchool = useCallback(async (schoolId: string, moduleId: string): Promise<ModuleUser[]> => {
    if (!isAuthenticated || !user) {
      return [];
    }

    try {
      const { data, error: fetchError } = await supabaseClient
        .rpc('get_module_users_for_school', { 
          target_school_id: schoolId, 
          target_module_id: moduleId 
        });

      if (fetchError) throw fetchError;

      return data || [];
    } catch (e) {
      console.error('Error fetching module users for school:', e);
      return [];
    }
  }, [user, isAuthenticated, supabaseClient]);

  const grantModuleAccess = useCallback(async (
    userId: string, 
    schoolId: string, 
    moduleId: string, 
    role: string
  ): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return false;
    }

    try {
      const { data, error: grantError } = await supabaseClient
        .rpc('grant_module_access', {
          target_user_id: userId,
          target_school_id: schoolId,
          target_module_id: moduleId,
          target_role: role
        });

      if (grantError) throw grantError;

      return data === true;
    } catch (e) {
      console.error('Error granting module access:', e);
      return false;
    }
  }, [user, isAuthenticated, supabaseClient]);

  const revokeModuleAccess = useCallback(async (
    userId: string, 
    schoolId: string, 
    moduleId: string
  ): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return false;
    }

    try {
      const { data, error: revokeError } = await supabaseClient
        .rpc('revoke_module_access', {
          target_user_id: userId,
          target_school_id: schoolId,
          target_module_id: moduleId
        });

      if (revokeError) throw revokeError;

      return data === true;
    } catch (e) {
      console.error('Error revoking module access:', e);
      return false;
    }
  }, [user, isAuthenticated, supabaseClient]);

  const canManageModulePermissions = useCallback(async (
    schoolId: string, 
    moduleId: string
  ): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return false;
    }

    try {
      const { data, error: checkError } = await supabaseClient
        .rpc('can_manage_module_permissions', {
          target_school_id: schoolId,
          target_module_id: moduleId
        });

      if (checkError) throw checkError;

      return data === true;
    } catch (e) {
      console.error('Error checking module management permissions:', e);
      return false;
    }
  }, [user, isAuthenticated, supabaseClient]);

  const hasModuleAccess = useCallback(async (
    schoolId: string, 
    moduleName: string
  ): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return false;
    }

    try {
      const { data, error: checkError } = await supabaseClient
        .rpc('has_module_access', {
          target_school_id: schoolId,
          target_module_name: moduleName
        });

      if (checkError) throw checkError;

      return data === true;
    } catch (e) {
      console.error('Error checking module access:', e);
      return false;
    }
  }, [user, isAuthenticated, supabaseClient]);

  const getUserModuleRole = useCallback(async (
    schoolId: string, 
    moduleName: string
  ): Promise<string | null> => {
    if (!isAuthenticated || !user) {
      return null;
    }

    try {
      const { data, error: fetchError } = await supabaseClient
        .rpc('get_user_module_role', {
          target_school_id: schoolId,
          target_module_name: moduleName
        });

      if (fetchError) throw fetchError;

      return data || null;
    } catch (e) {
      console.error('Error fetching user module role:', e);
      return null;
    }
  }, [user, isAuthenticated, supabaseClient]);

  return (
    <ModulesContext.Provider value={{
      modules,
      loading,
      error,
      fetchModules,
      getUserModulesForSchool,
      getModuleUsersForSchool,
      grantModuleAccess,
      revokeModuleAccess,
      canManageModulePermissions,
      hasModuleAccess,
      getUserModuleRole
    }}>
      {children}
    </ModulesContext.Provider>
  );
};

export const useModules = (): ModulesContextType => {
  const context = useContext(ModulesContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModulesProvider');
  }
  return context;
}; 