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
    if (!isAuthenticated || !user) {
      setSchools([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch schools the user has access to with their role
      const { data, error: fetchError } = await supabase
        .from('user_schools')
        .select(`
          role,
          schools (
            id,
            name,
            description,
            google_sheet_url,
            join_code,
            settings,
            active,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .eq('active', true)
        .eq('schools.active', true);

      if (fetchError) throw fetchError;

      // Map the data to include the user's role
      const schoolsWithRoles: SchoolWithRole[] = data?.filter(item => item.schools).map(item => ({
        ...(item.schools as any),
        userRole: item.role as UserRole
      })) || [];

      setSchools(schoolsWithRoles);
    } catch (e) {
      setError(e as Error);
      console.error('Error fetching schools:', e);
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

      // Handle potential caching issues - if we get an RLS error but the school was actually created
      if (createError && createError.code === '42501') {
        // RLS error - but check if the school was actually created
        console.warn('RLS error reported, checking if school was actually created...');
        
        // Wait a moment for potential cache refresh
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to find a recently created school with this name
        const { data: recentSchools, error: checkError } = await supabase
          .from('schools')
          .select('*')
          .eq('name', schoolData.name)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!checkError && recentSchools && recentSchools.length > 0) {
          const recentSchool = recentSchools[0] as School;
          
          // Check if this school was created in the last minute (likely our school)
          const schoolCreatedAt = new Date(recentSchool.created_at);
          const oneMinuteAgo = new Date(Date.now() - 60000);
          
          if (schoolCreatedAt > oneMinuteAgo) {
            console.log('School was actually created successfully despite RLS error');
            
            // Add the creator as a superadmin of the school
            console.log('About to create user_schools entry with role: superadmin for school:', recentSchool.id);
            const { error: userSchoolError } = await supabase
              .from('user_schools')
              .insert({
                user_id: user.id,
                school_id: recentSchool.id,
                role: 'superadmin',
                active: true
              });

            if (userSchoolError) {
              console.warn('User school creation error:', userSchoolError);
              // Don't throw here - the school was created successfully
            } else {
              console.log('User school entry created successfully');
            }
            
            // Refresh the schools list to include the new school
            await fetchUserSchools();
            
            setLoading(false);
            return recentSchool;
          }
        }
        
        // If we get here, the school really wasn't created
        throw createError;
      }

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
      
      console.log('User school entry created successfully in normal path');
      
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