import React, { createContext, useState, useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/core/lib/supabaseClient';
import { School, SchoolContextType, UserRole } from '../types';
import { useAuth } from './AuthContext';

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();

  const fetchSchool = async () => {
    if (!user || !schoolSlug) {
      setCurrentSchool(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, get the school by slug to get its ID
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('slug', schoolSlug)
        .eq('active', true)
        .eq('deleted', false)
        .single();

      if (schoolError) {
        throw new Error('School not found');
      }

      // Check user's role for this school (both school-level and module-level access)
      // First try school-level access
      const { data: userSchoolData, error: userSchoolError } = await supabase
        .from('user_schools')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', schoolData.id)
        .eq('active', true)
        .single();

      let userRole: string | null = null;

      if (!userSchoolError && userSchoolData) {
        // User has school-level access
        userRole = userSchoolData.role;
      } else {
        // Try module-level access
        const { data: moduleAccessData, error: moduleError } = await supabase
          .from('user_schools_modules')
          .select('role')
          .eq('user_id', user.id)
          .eq('school_id', schoolData.id)
          .eq('active', true);

        if (!moduleError && moduleAccessData && moduleAccessData.length > 0) {
          // User has module-level access - get the highest role
          const roles = moduleAccessData.map(item => item.role);
          if (roles.includes('superadmin')) {
            userRole = 'superadmin';
          } else if (roles.includes('admin')) {
            userRole = 'admin';
          } else {
            userRole = 'teacher';
          }
        }
      }

      if (!userRole) {
        throw new Error('Access denied to this school');
      }

      setCurrentSchool(schoolData);
      setUserRole(userRole as UserRole);
    } catch (err) {
      console.error('Error fetching school:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch school');
      setCurrentSchool(null);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshSchool = async () => {
    await fetchSchool();
  };

  useEffect(() => {
    fetchSchool();
  }, [user, schoolSlug]);

  const value: SchoolContextType = {
    currentSchool,
    userRole,
    loading,
    error,
    refreshSchool,
    setCurrentSchool,
    isSchoolAdmin: userRole === 'admin' || userRole === 'superadmin',
  };

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
};

export const useSchool = (): SchoolContextType => {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};