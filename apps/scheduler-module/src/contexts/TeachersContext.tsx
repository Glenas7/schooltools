import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Teacher, User } from '../types';
import { useSchool } from './SchoolContextWrapper';
import { useAuth } from './AuthContextWrapper';

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
  updateTeacherDetails: (id: string, updates: Partial<Pick<User, 'name'>>) => Promise<Teacher | null>;
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
     if (!currentSchool) return;
     setLoading(true);
     setError(null);

     try {
       // Try the new module-aware function first
       try {
         const { data: teachersData, error: functionError } = await supabase
           .rpc('get_school_teachers_for_module', { 
             target_school_id: currentSchool.id,
             target_module_name: 'scheduler'
           });

         if (!functionError && teachersData) {
           // Get subject assignments for all teachers
           const teacherIds = teachersData.map((t: User) => t.id);
           const { data: subjectAssignments } = await supabase
             .from('teachers_subjects')
             .select('teacher_id, subject_id')
             .in('teacher_id', teacherIds)
             .eq('school_id', currentSchool.id);

           // Group subject assignments by teacher ID
           const subjectsByTeacher = (subjectAssignments || []).reduce((acc, assignment) => {
             if (!acc[assignment.teacher_id]) {
               acc[assignment.teacher_id] = [];
             }
             acc[assignment.teacher_id].push(assignment.subject_id);
             return acc;
           }, {} as Record<string, string[]>);

           // Format teachers with subjects
           const formattedTeachers: Teacher[] = teachersData.map((teacher: User) => ({
             id: teacher.id,
             name: teacher.name,
             email: teacher.email,
             active: teacher.active,
             school_id: currentSchool.id,
             subjectIds: subjectsByTeacher[teacher.id] || [],
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString()
           }));

           setTeachers(formattedTeachers);
           setLoading(false);
           return;
         }
       } catch (functionError) {
         console.log('[DEBUG TeachersContext] Function failed, using fallback');
       }

       // Fallback: Use direct module queries
       const { data: schedulerModule } = await supabase
         .from('modules')
         .select('id')
         .eq('name', 'scheduler')
         .single();

       if (schedulerModule) {
         // Get module-level teachers (including inactive ones)
         const { data: moduleTeachers } = await supabase
           .from('users')
           .select(`
             id, name, email,
             user_schools_modules!inner(active, role)
           `)
           .eq('user_schools_modules.school_id', currentSchool.id)
           .eq('user_schools_modules.module_id', schedulerModule.id)
           .eq('user_schools_modules.role', 'teacher');

         // Get legacy teachers for backward compatibility (including inactive ones)
         const { data: legacyTeachers } = await supabase
           .from('users')
           .select(`
             id, name, email,
             user_schools!inner(active, role)
           `)
           .eq('user_schools.school_id', currentSchool.id)
           .eq('user_schools.role', 'teacher');

         // Combine and deduplicate
         const allTeachers = [
           ...(moduleTeachers || []),
           ...(legacyTeachers || [])
         ];
         const uniqueTeachers = allTeachers.filter((teacher, index, array) => 
           array.findIndex(t => t.id === teacher.id) === index
         );

         // Get subject assignments
         const teacherIds = uniqueTeachers.map(t => t.id);
         const { data: subjectAssignments } = await supabase
           .from('teachers_subjects')
           .select('teacher_id, subject_id')
           .in('teacher_id', teacherIds)
           .eq('school_id', currentSchool.id);

         const subjectsByTeacher = (subjectAssignments || []).reduce((acc, assignment) => {
           if (!acc[assignment.teacher_id]) {
             acc[assignment.teacher_id] = [];
           }
           acc[assignment.teacher_id].push(assignment.subject_id);
           return acc;
         }, {} as Record<string, string[]>);

         // Format final teachers list
         const finalTeachers: Teacher[] = uniqueTeachers.map((user: any) => {
           // Determine active status from module access or legacy access
           const moduleAccess = user.user_schools_modules;
           const legacyAccess = user.user_schools;
           
           // For module teachers, use the module active status
           // For legacy teachers, use the legacy active status
           // Prefer module status if both exist
           let isActive = false;
           if (moduleAccess) {
             isActive = moduleAccess.active;
           } else if (legacyAccess) {
             isActive = legacyAccess.active;
           }

           return {
             id: user.id,
             name: user.name,
             email: user.email,
             active: isActive,
             school_id: currentSchool.id,
             subjectIds: subjectsByTeacher[user.id] || [],
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString()
           };
         });

         setTeachers(finalTeachers);
       } else {
         setTeachers([]);
       }
     } catch (error) {
       console.error('Error fetching teachers:', error);
       setError(error as Error);
       setTeachers([]);
     } finally {
       setLoading(false);
     }
   }, [currentSchool]);

  // Fetch teachers when currentSchool changes
  useEffect(() => {
    console.log("[DEBUG TeachersContext] useEffect triggered for fetchTeachers");
    console.log("[DEBUG TeachersContext] - currentSchool changed:", currentSchool?.id);
    fetchTeachers();
  }, [currentSchool, fetchTeachers]);

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

        // Get the user's session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('User session not found. Please log in again.');
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...teacherData,
            school_id: currentSchool.id,
            role: 'teacher',
            module_name: 'scheduler'
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Failed to create teacher: ${errorData}`);
        }

        // Get the response data to have the created teacher info
        const responseData = await response.json();

        await fetchTeachers();
        
        // Return a minimal teacher object based on the successful response
        // The UI only needs to know the operation succeeded for modal closing
        const newTeacher: Teacher = {
          id: responseData.id,
          name: teacherData.name,
          email: teacherData.email,
          active: teacherData.active,
          school_id: currentSchool.id,
          subjectIds: teacherData.subjectIds || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return newTeacher;
      } catch (error) {
        setError(error as Error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    updateTeacherDetails: async (teacherId: string, updates: Partial<Pick<User, 'name'>>): Promise<Teacher | null> => {
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
