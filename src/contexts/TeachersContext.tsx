import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, User } from '../types';
import { useSchool } from './SchoolContext';
import { useAuth } from './AuthContext';

interface TeacherCreationData {
  email: string;
  name: string;
  subjectIds: string[];
  active: boolean;
}

export interface TeachersContextType {
  teachers: Teacher[];
  fetchTeachers: () => Promise<void>;
  addTeacher: (teacherData: TeacherCreationData) => Promise<Teacher | null>; 
  updateTeacherDetails: (id: string, updates: Partial<Pick<User, 'name' | 'active'>>) => Promise<Teacher | null>;
  updateTeacherSubjects: (teacherId: string, subjectIds: string[]) => Promise<void>;
  toggleTeacherActive: (teacherId: string) => Promise<void>;
  getTeacherById: (id: string) => Teacher | undefined;
  loading: boolean;
  error: Error | null;
}

export const TeachersContext = createContext<TeachersContextType | undefined>(undefined);

const TeachersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { currentSchool, isSchoolAdmin } = useSchool();
  const { user } = useAuth();

  const fetchTeachers = useCallback(async () => {
    if (!currentSchool) {
      setTeachers([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // First, get all user_schools relationships for teachers in this school
      const { data: userSchools, error: userSchoolsError } = await supabase
        .from('user_schools')
        .select('user_id, role')
        .eq('school_id', currentSchool.id)
        .eq('role', 'teacher')
        .eq('active', true);

      if (userSchoolsError) throw userSchoolsError;
      
      if (!userSchools || userSchools.length === 0) {
        setTeachers([]);
        return;
      }

      // Extract teacher IDs
      const teacherIds = userSchools.map(us => us.user_id);

      // Now fetch the user details for these teachers
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, active')
        .in('id', teacherIds)
        .eq('active', true);

      if (usersError) throw usersError;

      if (!users) {
        setTeachers([]);
        return;
      }

      // Get teachers_subjects for these teachers
      const { data: teacherSubjects, error: teacherSubjectsError } = await supabase
        .from('teachers_subjects')
        .select(`
          teacher_id,
          subjects (
            id,
            name,
            color
          )
        `)
        .in('teacher_id', teacherIds)
        .eq('school_id', currentSchool.id);

      if (teacherSubjectsError) throw teacherSubjectsError;

      // Build teachers array with subjects
      const teachersWithSubjects: Teacher[] = users.map(user => {
        const userSubjects = teacherSubjects
          ?.filter(ts => ts.teacher_id === user.id)
          ?.map(ts => ts.subjects)
          ?.filter(Boolean) || [];

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          active: user.active,
          school_id: currentSchool.id,
          subjectIds: userSubjects.map((subject: any) => subject.id),
          subjects: userSubjects,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      setTeachers(teachersWithSubjects);
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [currentSchool]);

  // Fetch teachers when currentSchool changes
  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const value: TeachersContextType = {
    teachers,
    loading,
    error,
    addTeacher: async (teacherData: Omit<Teacher, 'id' | 'subjects'> & { subjects: string[] }) => {
      try {
        setLoading(true);
        setError(null);

        if (!currentSchool) {
          throw new Error('No school selected');
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            ...teacherData,
            school_id: currentSchool.id,
            role: 'teacher'
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Failed to create teacher: ${errorData}`);
        }

        await fetchTeachers();
      } catch (error) {
        setError(error as Error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    updateTeacherDetails: async (teacherId: string, updates: { name?: string; email?: string }) => {
      try {
        setLoading(true);
        setError(null);

        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', teacherId);

        if (error) throw error;

        await fetchTeachers();
      } catch (error) {
        setError(error as Error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    updateTeacherSubjects: async (teacherId: string, subjectIds: string[]) => {
      try {
        setLoading(true);
        setError(null);

        if (!currentSchool) {
          throw new Error('No school selected');
        }

        // Delete existing subjects for this teacher in this school
        const { error: deleteError } = await supabase
          .from('teachers_subjects')
          .delete()
          .eq('teacher_id', teacherId)
          .eq('school_id', currentSchool.id);

        if (deleteError) throw deleteError;

        // Insert new subjects
        if (subjectIds.length > 0) {
          const { error: insertError } = await supabase
            .from('teachers_subjects')
            .insert(
              subjectIds.map(subjectId => ({
                teacher_id: teacherId,
                subject_id: subjectId,
                school_id: currentSchool.id
              }))
            );

          if (insertError) throw insertError;
        }

        await fetchTeachers();
      } catch (error) {
        setError(error as Error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    toggleTeacherActive: async (teacherId: string, active: boolean) => {
      try {
        setLoading(true);
        setError(null);

        // Update user active status
        const { error: userError } = await supabase
          .from('users')
          .update({ active })
          .eq('id', teacherId);

        if (userError) throw userError;

        // Update user_schools active status
        const { error: userSchoolError } = await supabase
          .from('user_schools')
          .update({ active })
          .eq('user_id', teacherId);

        if (userSchoolError) throw userSchoolError;

        await fetchTeachers();
      } catch (error) {
        setError(error as Error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    getTeacherById: (id: string): Teacher | undefined => {
      return teachers.find(teacher => teacher.id === id);
    }
  };

  return (
    <TeachersContext.Provider value={value}>
      {children}
    </TeachersContext.Provider>
  );
};

export { TeachersProvider };

export const useTeachers = () => {
  const context = useContext(TeachersContext);
  if (context === undefined) {
    throw new Error('useTeachers must be used within a TeachersProvider');
  }
  return context;
};
