import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTeachers } from '../contexts/TeachersContext';
import { useSchool } from '../contexts/SchoolContextWrapper';
import TeacherList from '../components/teachers/TeacherList';
import TeacherForm, { TeacherFormData } from '../components/teachers/TeacherForm';
import { Teacher } from '../types';
import { Plus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

const Teachers = () => {
  const { teachers, addTeacher, updateTeacherDetails, updateTeacherSubjects, toggleTeacherActive, loading } = useTeachers();
  const { currentSchool, isSchoolAdmin } = useSchool();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!currentSchool) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Teachers
          </h1>
        </div>
        
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Please select a school to manage teachers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const handleAddTeacher = () => {
    setEditingTeacher(undefined);
    setIsFormOpen(true);
  };
  
  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setIsFormOpen(true);
  };
  
  const handleToggleActive = async (teacherId: string) => {
    console.log("[DEBUG Teachers] handleToggleActive called with teacherId:", teacherId);
    const teacherBeforeToggle = teachers.find(t => t.id === teacherId);
    console.log("[DEBUG Teachers] Teacher before toggle:", teacherBeforeToggle);
    if (!teacherBeforeToggle) return;

    const newActiveStatus = !teacherBeforeToggle.active;
    console.log("[DEBUG Teachers] Will set active status to:", newActiveStatus);

    try {
      console.log("[DEBUG Teachers] Calling toggleTeacherActive with:", { teacherId, active: newActiveStatus });
      await toggleTeacherActive(teacherId, newActiveStatus);
      
      console.log("[DEBUG Teachers] toggleTeacherActive completed successfully");
      toast({
        title: `Teacher ${newActiveStatus ? 'activated' : 'deactivated'}`,
        description: `${teacherBeforeToggle.name} has been ${newActiveStatus ? 'activated' : 'deactivated'}.`,
      });
    } catch (error) {
      console.error("[DEBUG Teachers] Error in handleToggleActive:", error);
      toast({
        title: "Error",
        description: "Failed to update teacher status. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleSaveTeacher = async (dataFromForm: TeacherFormData) => {
    setIsSubmitting(true);
    try {
      if (dataFromForm.id) {
        // Editing existing teacher
        let detailsUpdated = false;
        let subjectsUpdated = false;

        // Check if name changed
        const detailUpdates: Partial<Pick<Teacher, 'name'>> = {};
        if (dataFromForm.name !== editingTeacher?.name) {
          detailUpdates.name = dataFromForm.name;
        }

        // Handle name updates
        if (Object.keys(detailUpdates).length > 0) {
          await updateTeacherDetails(dataFromForm.id, detailUpdates);
          detailsUpdated = true;
        }

        // Handle active status change separately using the correct function
        if (dataFromForm.active !== editingTeacher?.active) {
          await toggleTeacherActive(dataFromForm.id, dataFromForm.active);
          detailsUpdated = true;
        }

        // Check if subjects changed
        const originalSubjectIds = editingTeacher?.subjectIds?.slice().sort() || [];
        const newSubjectIds = dataFromForm.subjectIds.slice().sort() || [];
        
        if (JSON.stringify(originalSubjectIds) !== JSON.stringify(newSubjectIds)) {
          await updateTeacherSubjects(dataFromForm.id, dataFromForm.subjectIds);
          subjectsUpdated = true;
        }

        if (detailsUpdated || subjectsUpdated) {
          toast({
            title: "Teacher updated",
            description: `${dataFromForm.name} has been updated successfully.`,
          });
        } else {
          toast({
            title: "No changes detected",
            description: "No changes were made to the teacher.",
          });
        }
        setIsFormOpen(false);
        setEditingTeacher(undefined);
      } else {
        // Creating new teacher
        const teacherCreationData = {
          email: dataFromForm.email,
          name: dataFromForm.name,
          subjectIds: dataFromForm.subjectIds || [],
          active: dataFromForm.active
        };
        
        const newTeacher = await addTeacher(teacherCreationData);
        
        if (newTeacher) {
          toast({
            title: "Teacher added",
            description: `${dataFromForm.name} has been added successfully.`,
          });
          setIsFormOpen(false);
          setEditingTeacher(undefined);
        }
      }
    } catch (error) {
      console.error("Error in handleSaveTeacher:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save teacher. The email may already be in use.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6" />
          Teachers - {currentSchool.name}
        </h1>
        {isSchoolAdmin && (
          <Button onClick={handleAddTeacher}>
            <Plus className="h-4 w-4 mr-1" />
            Add Teacher
          </Button>
        )}
      </div>
      
      <TeacherList 
        teachers={teachers}
        onEditTeacher={handleEditTeacher}
        onToggleActive={handleToggleActive}
        loading={loading}
      />
      
      <TeacherForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveTeacher}
        teacher={editingTeacher}
        loading={isSubmitting}
      />
    </div>
  );
};

export default Teachers;
