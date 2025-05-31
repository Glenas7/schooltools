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
    const loadSchool = async () => {
      if (!isAuthenticated || !user) {
        setCurrentSchoolState(null);
        setUserRole(null);
        return;
      }

      // Priority 1: Use schoolId from URL if available
      let targetSchoolId = schoolId;
      
      // Priority 2: Fall back to localStorage if no URL schoolId
      if (!targetSchoolId) {
        targetSchoolId = localStorage.getItem('currentSchoolId');
      }

      if (targetSchoolId) {
        // Inline the school switching logic to avoid function dependency
        try {
          // Verify user has access to this school and get the school details
          const { data: userSchool, error: userSchoolError } = await supabase
            .from('user_schools')
            .select('role')
            .eq('user_id', user.id)
            .eq('school_id', targetSchoolId)
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
            .eq('id', targetSchoolId)
            .eq('active', true)
            .single();

          if (schoolError || !school) {
            console.error('School not found');
            return;
          }

          setCurrentSchoolState(school as School);
          setUserRole(userSchool.role as UserRole);
          localStorage.setItem('currentSchoolId', targetSchoolId);
        } catch (e) {
          console.error('Error loading school:', e);
        }
      }
    };

    loadSchool();
  }, [isAuthenticated, user?.id, schoolId]);

  const isSchoolAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSchoolSuperAdmin = userRole === 'superadmin';
  const isSchoolTeacher = userRole === 'teacher';

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