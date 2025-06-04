import React, { createContext, useState, useContext, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { School, CreateSchoolData, SchoolWithRole, UserRole } from '../types';
import { useAuth } from './AuthContext';

interface SchoolsContextType {
  schools: SchoolWithRole[];
  loading: boolean;
  error: Error | null;
  fetchUserSchools: () => Promise<void>;
  createSchool: (schoolData: CreateSchoolData) => Promise<School | null>;
  joinSchool: (joinCode: string) => Promise<School | null>;
  updateSchool: (schoolId: string, updates: Partial<School>) => Promise<School | null>;
  deleteSchool: (schoolId: string) => Promise<boolean>;
}

const SchoolsContext = createContext<SchoolsContextType | undefined>(undefined);

export const SchoolsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      console.log('[SchoolsContext] Fetching user_schools for user:', user.id);
      
      // First, get the user's school relationships
      const { data: userSchoolsData, error: userSchoolsError } = await supabase
        .from('user_schools')
        .select('school_id, role')
        .eq('user_id', user.id)
        .eq('active', true);

      if (userSchoolsError) throw userSchoolsError;

      console.log('[SchoolsContext] user_schools query result:', userSchoolsData?.length || 0, 'relationships');

      if (!userSchoolsData || userSchoolsData.length === 0) {
        console.log('[SchoolsContext] No school relationships found, setting empty schools');
        setSchools([]);
        setLoading(false);
        return;
      }

      // Then get the school details separately
      const schoolIds = userSchoolsData.map(us => us.school_id);
      console.log('[SchoolsContext] Fetching school details for IDs:', schoolIds);
      
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name, description, google_sheet_url, join_code, settings, active, created_at, updated_at')
        .in('id', schoolIds)
        .eq('active', true);

      if (schoolsError) throw schoolsError;

      console.log('[SchoolsContext] Schools query result:', schoolsData?.length || 0, 'schools');

      // Combine the data
      const schoolsWithRoles: SchoolWithRole[] = (schoolsData || []).map(school => {
        const userSchool = userSchoolsData.find(us => us.school_id === school.id);
        return {
          ...school,
          userRole: userSchool?.role as UserRole
        };
      });

      console.log('[SchoolsContext] Final schools with roles:', schoolsWithRoles.length, 'schools');
      setSchools(schoolsWithRoles);
    } catch (e) {
      console.error('[SchoolsContext] Error fetching schools:', e);
      setError(e as Error);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  const createSchool = async (schoolData: CreateSchoolData): Promise<School | null> => {
    if (!user) {
      setError(new Error('User not authenticated'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate a random join code
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error: createError } = await supabase
        .from('schools')
        .insert({
          name: schoolData.name,
          description: schoolData.description,
          google_sheet_url: schoolData.google_sheet_url,
          join_code: joinCode,
          active: true
        })
        .select()
        .single();

      if (createError) throw createError;

      const newSchool = data as School;

      // Add the creator as a superadmin of the school
      console.log('About to create user_schools entry with role: superadmin for school:', newSchool.id);
      const { error: userSchoolError } = await supabase
        .from('user_schools')
        .insert({
          user_id: user.id,
          school_id: newSchool.id,
          role: 'superadmin',
          active: true
        });

      if (userSchoolError) throw userSchoolError;
      
      console.log('User school entry created successfully');
      
      // Refresh the schools list to include the new school
      await fetchUserSchools();
      
      setLoading(false);
      return newSchool;
    } catch (e) {
      setError(e as Error);
      console.error('Error creating school:', e);
      setLoading(false);
      return null;
    }
  };

  const joinSchool = async (joinCode: string): Promise<School | null> => {
    if (!user) {
      setError(new Error('User not authenticated'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // First, find the school with the join code
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('join_code', joinCode.toUpperCase())
        .eq('active', true)
        .single();

      if (schoolError || !schoolData) {
        throw new Error('Invalid join code or school not found');
      }

      const school = schoolData as School;

      // Check if user is already a member of this school
      const { data: existingMembership } = await supabase
        .from('user_schools')
        .select('id')
        .eq('user_id', user.id)
        .eq('school_id', school.id)
        .single();

      if (existingMembership) {
        throw new Error('You are already a member of this school');
      }

      // Add the user as a teacher to the school
      const { error: userSchoolError } = await supabase
        .from('user_schools')
        .insert({
          user_id: user.id,
          school_id: school.id,
          role: 'teacher',
          active: true
        });

      if (userSchoolError) throw userSchoolError;
      
      // Refresh the schools list to include the joined school
      await fetchUserSchools();
      
      setLoading(false);
      return school;
    } catch (e) {
      setError(e as Error);
      console.error('Error joining school:', e);
      setLoading(false);
      return null;
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
      const { data, error: updateError } = await supabase
        .from('schools')
        .update(updates)
        .eq('id', schoolId)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedSchool = data as School;
      
      // Update the local state
      setSchools(prev => prev.map(school => 
        school.id === schoolId 
          ? { ...school, ...updatedSchool }
          : school
      ));
      
      setLoading(false);
      return updatedSchool;
    } catch (e) {
      setError(e as Error);
      console.error('Error updating school:', e);
      setLoading(false);
      return null;
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
      const { error: deleteError } = await supabase
        .from('schools')
        .delete()
        .eq('id', schoolId);

      if (deleteError) throw deleteError;

      // Remove from local state
      setSchools(prev => prev.filter(school => school.id !== schoolId));
      
      setLoading(false);
      return true;
    } catch (e) {
      setError(e as Error);
      console.error('Error deleting school:', e);
      setLoading(false);
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
      joinSchool,
      updateSchool,
      deleteSchool
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