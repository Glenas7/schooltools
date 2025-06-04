import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { School, UserRole, SchoolContextType, UserSchool } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const { user, isAuthenticated } = useAuth();
  const { schoolId } = useParams<{ schoolId: string }>();

  // Get user's role in the current school
  const fetchUserRoleInSchool = async (schoolId: string, userId: string) => {
    try {
      const { data, error } = await supabase
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
      // Verify user has access to this school and get the school details
      const { data: userSchool, error: userSchoolError } = await supabase
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
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .eq('active', true)
        .single();

      if (schoolError || !school) {
        console.error('School not found');
        return;
      }

      setCurrentSchoolState(school as School);
      setUserRole(userSchool.role as UserRole);
      localStorage.setItem('currentSchoolId', schoolId);
    } catch (e) {
      console.error('Error switching school:', e);
    }
  }, [user]);

  // Refresh current school data
  const refreshSchool = async () => {
    if (!currentSchool || !user) return;
    
    try {
      // Fetch updated school details
      const { data: school, error: schoolError } = await supabase
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
    console.log('[DEBUG SchoolContext] loadSchool effect triggered. isAuthenticated:', isAuthenticated, 'user:', user?.id, 'schoolId:', schoolId);
    console.log('[DEBUG SchoolContext] Effect dependencies - isAuthenticated changed:', isAuthenticated, 'user?.id changed:', user?.id, 'schoolId changed:', schoolId);
    
    const loadSchool = async () => {
      console.log('[DEBUG SchoolContext] Starting loadSchool async function');
      
      if (!isAuthenticated || !user) {
        console.log('[DEBUG SchoolContext] Not authenticated or no user, clearing school state');
        console.log('[DEBUG SchoolContext] - isAuthenticated:', isAuthenticated);
        console.log('[DEBUG SchoolContext] - user exists:', !!user);
        console.log('[DEBUG SchoolContext] - user id:', user?.id);
        setCurrentSchoolState(null);
        setUserRole(null);
        return;
      }

      console.log('[DEBUG SchoolContext] User is authenticated, proceeding with school loading');
      console.log('[DEBUG SchoolContext] - User ID:', user.id);
      console.log('[DEBUG SchoolContext] - URL schoolId:', schoolId);

      // Priority 1: Use schoolId from URL if available
      let targetSchoolId = schoolId;
      
      // Priority 2: Fall back to localStorage if no URL schoolId
      if (!targetSchoolId) {
        targetSchoolId = localStorage.getItem('currentSchoolId');
        console.log('[DEBUG SchoolContext] No URL schoolId, using localStorage:', targetSchoolId);
      } else {
        console.log('[DEBUG SchoolContext] Using URL schoolId:', targetSchoolId);
      }

      console.log('[DEBUG SchoolContext] Final targetSchoolId to load:', targetSchoolId);

      if (targetSchoolId) {
        console.log('[DEBUG SchoolContext] Loading school with ID:', targetSchoolId);
        // Inline the school switching logic to avoid function dependency
        try {
          console.log('[DEBUG SchoolContext] Step 1: Verifying user access to school');
          console.log('[DEBUG SchoolContext] Querying user_schools with user_id:', user.id, 'school_id:', targetSchoolId);
          
          // Verify user has access to this school and get the school details
          const { data: userSchool, error: userSchoolError } = await supabase
            .from('user_schools')
            .select('role')
            .eq('user_id', user.id)
            .eq('school_id', targetSchoolId)
            .eq('active', true)
            .single();

          console.log('[DEBUG SchoolContext] user_schools query result:');
          console.log('- error:', userSchoolError);
          console.log('- data:', userSchool);
          console.log('- user role:', userSchool?.role);

          if (userSchoolError || !userSchool) {
            console.error('[DEBUG SchoolContext] User does not have access to this school:', userSchoolError);
            console.error('[DEBUG SchoolContext] Error details:', {
              code: userSchoolError?.code,
              message: userSchoolError?.message,
              details: userSchoolError?.details,
              hint: userSchoolError?.hint
            });
            setCurrentSchoolState(null);
            setUserRole(null);
            return;
          }

          console.log('[DEBUG SchoolContext] User has access with role:', userSchool.role);

          console.log('[DEBUG SchoolContext] Step 2: Fetching school details');
          console.log('[DEBUG SchoolContext] Querying schools with id:', targetSchoolId);
          
          // Fetch the school details
          const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('*')
            .eq('id', targetSchoolId)
            .eq('active', true)
            .single();

          console.log('[DEBUG SchoolContext] schools query result:');
          console.log('- error:', schoolError);
          console.log('- data:', school);
          console.log('- school name:', school?.name);

          if (schoolError || !school) {
            console.error('[DEBUG SchoolContext] School not found:', schoolError);
            console.error('[DEBUG SchoolContext] School error details:', {
              code: schoolError?.code,
              message: schoolError?.message,
              details: schoolError?.details,
              hint: schoolError?.hint
            });
            setCurrentSchoolState(null);
            setUserRole(null);
            return;
          }

          console.log('[DEBUG SchoolContext] School loaded successfully:', school.name);
          console.log('[DEBUG SchoolContext] Setting currentSchool state and userRole:', userSchool.role);
          
          console.log('[DEBUG SchoolContext] About to call setCurrentSchoolState with:', school);
          setCurrentSchoolState(school as School);
          console.log('[DEBUG SchoolContext] About to call setUserRole with:', userSchool.role);
          setUserRole(userSchool.role as UserRole);
          localStorage.setItem('currentSchoolId', targetSchoolId);
          
          console.log('[DEBUG SchoolContext] School context fully loaded');
          console.log('- currentSchool ID:', school.id);
          console.log('- currentSchool name:', school.name);
          console.log('- userRole:', userSchool.role);
          console.log('- isSchoolAdmin:', (userSchool.role === 'admin' || userSchool.role === 'superadmin'));
        } catch (e) {
          console.error('[DEBUG SchoolContext] Error loading school:', e);
          console.error('[DEBUG SchoolContext] Exception details:', {
            message: (e as Error).message,
            stack: (e as Error).stack
          });
          setCurrentSchoolState(null);
          setUserRole(null);
        }
      } else {
        console.log('[DEBUG SchoolContext] No targetSchoolId found, not loading any school');
        setCurrentSchoolState(null);
        setUserRole(null);
      }
    };

    console.log('[DEBUG SchoolContext] About to call loadSchool async function');
    loadSchool().then(() => {
      console.log('[DEBUG SchoolContext] loadSchool completed successfully');
    }).catch((error) => {
      console.error('[DEBUG SchoolContext] loadSchool failed with error:', error);
    });
  }, [isAuthenticated, user?.id, schoolId]);

  const isSchoolAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSchoolSuperAdmin = userRole === 'superadmin';
  const isSchoolTeacher = userRole === 'teacher';

  console.log('[DEBUG SchoolContext] Current computed values (render triggered):');
  console.log('- currentSchool:', currentSchool?.id, currentSchool?.name);
  console.log('- userRole:', userRole);
  console.log('- isSchoolAdmin:', isSchoolAdmin);
  console.log('- isSchoolSuperAdmin:', isSchoolSuperAdmin);
  console.log('- isSchoolTeacher:', isSchoolTeacher);
  console.log('- Effect dependencies: isAuthenticated =', isAuthenticated, ', user?.id =', user?.id, ', schoolId =', schoolId);

  return (
    <SchoolContext.Provider value={{
      currentSchool,
      userRole,
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