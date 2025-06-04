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
  toggleTeacherActive: (teacherId: string, active: boolean) => Promise<void>;
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
    console.log("[DEBUG TeachersContext] fetchTeachers called");
    console.log("[DEBUG TeachersContext] - currentSchool:", currentSchool?.id, currentSchool?.name);
    console.log("[DEBUG TeachersContext] - isSchoolAdmin:", isSchoolAdmin);
    console.log("[DEBUG TeachersContext] - user:", user?.id, user?.name);
    
    if (!currentSchool) {
      console.log("[DEBUG TeachersContext] No currentSchool, setting empty teachers array");
      setTeachers([]);
      return;
    }
    
    console.log("[DEBUG TeachersContext] Starting teacher fetch for school:", currentSchool.id);
    setLoading(true);
    setError(null);
    
    try {
      if (isSchoolAdmin) {
        console.log("[DEBUG TeachersContext] Admin path: Using enhanced RLS approach");
        
        // Try the function first, but fall back to RLS queries if it fails
        try {
          console.log("[DEBUG TeachersContext] Attempting secure function call");
          const { data: teacherData, error: teachersError } = await supabase
            .rpc('get_school_teachers', { target_school_id: currentSchool.id });

          if (teachersError) {
            console.log("[DEBUG TeachersContext] Function failed, falling back to RLS queries:", teachersError.message);
            throw teachersError; // Will be caught and trigger fallback
          }

          if (teacherData && teacherData.length > 0) {
            console.log("[DEBUG TeachersContext] Function succeeded, processing results");
            // Process function results (same as before)
            const teacherIds = teacherData.map(t => t.id);
            console.log("[DEBUG TeachersContext] Teacher IDs from function:", teacherIds);

            // Get teacher subjects
            console.log("[DEBUG TeachersContext] Fetching teacher subjects");
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

            if (teacherSubjectsError) {
              console.error("[DEBUG TeachersContext] Error fetching teacher subjects:", teacherSubjectsError);
              throw teacherSubjectsError;
            }

            // Build teachers array with subjects
            const teachersWithSubjects: Teacher[] = teacherData.map(teacher => {
              const userSubjects = teacherSubjects
                ?.filter(ts => ts.teacher_id === teacher.id)
                ?.map(ts => ts.subjects)
                ?.filter(Boolean) || [];

              const teacherObj = {
                id: teacher.id,
                name: teacher.name,
                email: teacher.email,
                active: teacher.active,
                school_id: currentSchool.id,
                subjectIds: userSubjects.map((subject: any) => subject.id),
                subjects: userSubjects,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              console.log("[DEBUG TeachersContext] Built teacher:", {
                id: teacherObj.id,
                name: teacherObj.name,
                active: teacherObj.active,
                subjectCount: teacherObj.subjects.length
              });
              
              return teacherObj;
            });

            console.log("[DEBUG TeachersContext] Final teachers array (function path):");
            console.log("- count:", teachersWithSubjects.length);
            console.log("- teachers:", teachersWithSubjects.map(t => ({ id: t.id, name: t.name, active: t.active })));

            setTeachers(teachersWithSubjects);
            console.log("[DEBUG TeachersContext] Teachers state updated successfully (function path)");
            return; // Success, exit early
          }
        } catch (functionError) {
          console.log("[DEBUG TeachersContext] Function approach failed, using RLS fallback");
        }
        
        // Fallback: Use RLS-based queries (safer approach)
        console.log("[DEBUG TeachersContext] Admin fallback: Using RLS-based queries");
        
        // Step 1: Get user_schools for teachers in this school
        const { data: userSchools, error: userSchoolsError } = await supabase
          .from('user_schools')
          .select('user_id, role')
          .eq('school_id', currentSchool.id)
          .eq('role', 'teacher');

        console.log("[DEBUG TeachersContext] Admin RLS - user_schools query result:");
        console.log("- error:", userSchoolsError);
        console.log("- data:", userSchools);
        console.log("- count:", userSchools?.length || 0);

        if (userSchoolsError) {
          console.error("[DEBUG TeachersContext] Error fetching user_schools (admin RLS):", userSchoolsError);
          throw userSchoolsError;
        }
        
        if (!userSchools || userSchools.length === 0) {
          console.log("[DEBUG TeachersContext] No teacher relationships found (admin RLS)");
          setTeachers([]);
          setLoading(false);
          return;
        }

        // Step 2: Get user details - include both active and inactive users
        const teacherIds = userSchools.map(us => us.user_id);
        console.log("[DEBUG TeachersContext] Admin RLS - Teacher IDs:", teacherIds);

        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, name, email, active')
          .in('id', teacherIds);

        console.log("[DEBUG TeachersContext] Admin RLS - users query result:");
        console.log("- error:", usersError);
        console.log("- data:", users);
        console.log("- count:", users?.length || 0);

        if (usersError) {
          console.error("[DEBUG TeachersContext] Error fetching users (admin RLS):", usersError);
          throw usersError;
        }

        if (!users || users.length === 0) {
          console.log("[DEBUG TeachersContext] No user records found (admin RLS)");
          setTeachers([]);
          setLoading(false);
          return;
        }

        // Step 3: Get teacher subjects
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

        if (teacherSubjectsError) {
          console.error("[DEBUG TeachersContext] Error fetching teacher subjects (admin RLS):", teacherSubjectsError);
          throw teacherSubjectsError;
        }

        // Build teachers array
        const teachersWithSubjects: Teacher[] = users.map(user => {
          const userSubjects = teacherSubjects
            ?.filter(ts => ts.teacher_id === user.id)
            ?.map(ts => ts.subjects)
            ?.filter(Boolean) || [];

          const teacher = {
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
          
          console.log("[DEBUG TeachersContext] Built teacher (admin RLS):", {
            id: teacher.id,
            name: teacher.name,
            active: teacher.active,
            subjectCount: teacher.subjects.length
          });
          
          return teacher;
        });

        console.log("[DEBUG TeachersContext] Final teachers array (admin RLS fallback):");
        console.log("- count:", teachersWithSubjects.length);
        console.log("- teachers:", teachersWithSubjects.map(t => ({ id: t.id, name: t.name, active: t.active })));

        setTeachers(teachersWithSubjects);
        console.log("[DEBUG TeachersContext] Teachers state updated successfully (admin RLS fallback)");
        
      } else {
        console.log("[DEBUG TeachersContext] Non-admin path: Using standard queries");
        // For non-admins (teachers), use the existing approach
        console.log("[DEBUG TeachersContext] Step 1: Fetching user_schools relationships");
        const { data: userSchools, error: userSchoolsError } = await supabase
          .from('user_schools')
          .select('user_id, role')
          .eq('school_id', currentSchool.id)
          .eq('role', 'teacher');
          // Removed .eq('active', true) - teachers should never be fully removed from schools

        console.log("[DEBUG TeachersContext] user_schools query result:");
        console.log("- error:", userSchoolsError);
        console.log("- data:", userSchools);
        console.log("- count:", userSchools?.length || 0);

        if (userSchoolsError) {
          console.error("[DEBUG TeachersContext] Error fetching user_schools:", userSchoolsError);
          throw userSchoolsError;
        }
        
        if (!userSchools || userSchools.length === 0) {
          console.log("[DEBUG TeachersContext] No teacher relationships found, setting empty array");
          setTeachers([]);
          setLoading(false);
          return;
        }

        // Extract teacher IDs
        const teacherIds = userSchools.map(us => us.user_id);
        console.log("[DEBUG TeachersContext] Step 2: Teacher IDs found:", teacherIds);

        console.log("[DEBUG TeachersContext] Step 3: Fetching user details for teachers");
        // Now fetch the user details for these teachers - include both active and inactive
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, name, email, active')
          .in('id', teacherIds);

        console.log("[DEBUG TeachersContext] users query result:");
        console.log("- error:", usersError);
        console.log("- data:", users);
        console.log("- count:", users?.length || 0);

        if (usersError) {
          console.error("[DEBUG TeachersContext] Error fetching users:", usersError);
          throw usersError;
        }

        if (!users) {
          console.log("[DEBUG TeachersContext] No user records found, setting empty array");
          setTeachers([]);
          setLoading(false);
          return;
        }

        console.log("[DEBUG TeachersContext] Step 4: Fetching teacher subjects");
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

        console.log("[DEBUG TeachersContext] teachers_subjects query result:");
        console.log("- error:", teacherSubjectsError);
        console.log("- data:", teacherSubjects);
        console.log("- count:", teacherSubjects?.length || 0);

        if (teacherSubjectsError) {
          console.error("[DEBUG TeachersContext] Error fetching teacher subjects:", teacherSubjectsError);
          throw teacherSubjectsError;
        }

        console.log("[DEBUG TeachersContext] Step 5: Building teachers array with subjects");
        // Build teachers array with subjects
        const teachersWithSubjects: Teacher[] = users.map(user => {
          const userSubjects = teacherSubjects
            ?.filter(ts => ts.teacher_id === user.id)
            ?.map(ts => ts.subjects)
            ?.filter(Boolean) || [];

          const teacher = {
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
          
          console.log("[DEBUG TeachersContext] Built teacher:", {
            id: teacher.id,
            name: teacher.name,
            active: teacher.active,
            subjectCount: teacher.subjects.length
          });
          
          return teacher;
        });

        console.log("[DEBUG TeachersContext] Final teachers array (non-admin path):");
        console.log("- count:", teachersWithSubjects.length);
        console.log("- teachers:", teachersWithSubjects.map(t => ({ id: t.id, name: t.name, active: t.active })));

        setTeachers(teachersWithSubjects);
        console.log("[DEBUG TeachersContext] Teachers state updated successfully (non-admin path)");
      }
    } catch (error) {
      console.error("[DEBUG TeachersContext] Exception in fetchTeachers:", error);
      setError(error as Error);
    } finally {
      setLoading(false);
      console.log("[DEBUG TeachersContext] fetchTeachers completed, loading set to false");
    }
  }, [currentSchool, isSchoolAdmin, user]);

  // Fetch teachers when currentSchool changes
  useEffect(() => {
    console.log("[DEBUG TeachersContext] useEffect triggered for fetchTeachers");
    console.log("[DEBUG TeachersContext] - currentSchool changed:", currentSchool?.id);
    fetchTeachers();
  }, [fetchTeachers]);

  const value: TeachersContextType = {
    teachers,
    loading,
    error,
    fetchTeachers,
    addTeacher: async (teacherData: TeacherCreationData): Promise<Teacher | null> => {
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
        
        // Return the newly created teacher (find in updated teachers array)
        const newTeacher = teachers.find(t => t.email === teacherData.email);
        return newTeacher || null;
      } catch (error) {
        setError(error as Error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    updateTeacherDetails: async (teacherId: string, updates: Partial<Pick<User, 'name' | 'active'>>): Promise<Teacher | null> => {
      try {
        setLoading(true);
        setError(null);

        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', teacherId);

        if (error) throw error;

        await fetchTeachers();
        
        // Return the updated teacher
        const updatedTeacher = teachers.find(t => t.id === teacherId);
        return updatedTeacher || null;
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
      console.log("[DEBUG TeachersContext] toggleTeacherActive called with:", { teacherId, active });
      console.log("[DEBUG TeachersContext] - currentSchool:", currentSchool?.id, currentSchool?.name);
      
      try {
        setLoading(true);
        setError(null);

        if (!currentSchool) {
          throw new Error('No school selected');
        }

        // Check authentication context
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        console.log("[DEBUG TeachersContext] Current session:", { 
          userId: session?.session?.user?.id, 
          email: session?.session?.user?.email,
          sessionError 
        });

        console.log("[DEBUG TeachersContext] Calling database function toggle_teacher_active");
        // Use the secure database function instead of direct table updates
        const { data: functionResult, error: functionError } = await supabase
          .rpc('toggle_teacher_active', {
            teacher_id: teacherId,
            new_active_status: active,
            target_school_id: currentSchool.id
          });

        console.log("[DEBUG TeachersContext] Function result:", { functionResult, functionError });
        
        if (functionError) {
          throw new Error(`Failed to toggle teacher status: ${functionError.message}`);
        }

        console.log("[DEBUG TeachersContext] Function completed successfully, refetching teachers");
        await fetchTeachers();
        console.log("[DEBUG TeachersContext] toggleTeacherActive completed successfully");
      } catch (error) {
        console.error("[DEBUG TeachersContext] Error in toggleTeacherActive:", error);
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
