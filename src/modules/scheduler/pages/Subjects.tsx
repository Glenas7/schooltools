import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useSubjects } from '../contexts/SubjectsContext';
import { useSchool } from '@/core/contexts';
import SubjectList from '../components/subjects/SubjectList';
import SubjectForm from '../components/subjects/SubjectForm';
import { Subject } from '../types';
import { Plus, BookOpen } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

const Subjects = () => {
  const { subjects, deleteSubject } = useSubjects();
  const { currentSchool, isSchoolAdmin } = useSchool();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | undefined>(undefined);
  const { toast } = useToast();

  if (!currentSchool) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Subjects
          </h1>
        </div>
        
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Please select a school to manage subjects.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const handleAddSubject = () => {
    setEditingSubject(undefined);
    setIsFormOpen(true);
  };
  
  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setIsFormOpen(true);
  };
  
  const handleDeletePrompt = (id: string) => {
    setDeletingSubjectId(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (deletingSubjectId) {
      const subject = subjects.find(s => s.id === deletingSubjectId);
      try {
        await deleteSubject(deletingSubjectId);
        
        if (subject) {
          toast({
            title: "Subject deleted",
            description: `${subject.name} has been deleted.`,
          });
        }
      } catch (error) {
        toast({
          title: "Error deleting subject",
          description: "Failed to delete the subject. Please try again.",
          variant: "destructive",
        });
      }
      
      setIsDeleteDialogOpen(false);
      setDeletingSubjectId(null);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Subjects - {currentSchool.name}
        </h1>
        {isSchoolAdmin && (
          <Button onClick={handleAddSubject}>
            <Plus className="h-4 w-4 mr-1" />
            Add Subject
          </Button>
        )}
      </div>
      
      <SubjectList 
        subjects={subjects}
        onEditSubject={handleEditSubject}
        onDeleteSubject={handleDeletePrompt}
      />
      
      <SubjectForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        subject={editingSubject}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the subject
              and remove it from any associated teachers and lessons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Subjects;
