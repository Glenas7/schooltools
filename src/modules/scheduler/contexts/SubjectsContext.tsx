import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/core/lib/supabaseClient';
import { Subject } from '../types';
import { useSchool } from '@/core/contexts';

interface SubjectsContextType {
  subjects: Subject[];
  fetchSubjects: () => Promise<void>;
  createSubject: (subjectData: Omit<Subject, 'id' | 'school_id' | 'created_at' | 'updated_at'>) => Promise<Subject | null>;
  updateSubject: (subjectData: Partial<Subject> & { id: string }) => Promise<Subject | null>;
  deleteSubject: (subjectId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

const SubjectsContext = createContext<SubjectsContextType | undefined>(undefined);

const SubjectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { currentSchool, isSchoolAdmin } = useSchool();

  const fetchSubjects = useCallback(async () => {
    if (!currentSchool) {
      setSubjects([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('name');

      if (fetchError) throw fetchError;

      setSubjects(data || []);
    } catch (e) {
      setError(e as Error);
      console.error('Error fetching subjects:', e);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [currentSchool]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const createSubject = async (subjectData: Omit<Subject, 'id' | 'school_id' | 'created_at' | 'updated_at'>): Promise<Subject | null> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error("Admin access required"));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: createError } = await supabase
        .from('subjects')
        .insert({
          ...subjectData,
          school_id: currentSchool.id
        })
        .select()
        .single();

      if (createError) throw createError;

      const newSubject = data as Subject;
      setSubjects(prev => [...prev, newSubject]);
      setLoading(false);
      return newSubject;
    } catch (e) {
      setError(e as Error);
      console.error('Error creating subject:', e);
      setLoading(false);
      return null;
    }
  };

  const updateSubject = async (subjectData: Partial<Subject> & { id: string }): Promise<Subject | null> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error("Admin access required"));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('subjects')
        .update({
          name: subjectData.name,
          color: subjectData.color
        })
        .eq('id', subjectData.id)
        .eq('school_id', currentSchool.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedSubject = data as Subject;
      setSubjects(prev => prev.map(subject => 
        subject.id === subjectData.id ? updatedSubject : subject
      ));
      setLoading(false);
      return updatedSubject;
    } catch (e) {
      setError(e as Error);
      console.error('Error updating subject:', e);
      setLoading(false);
      return null;
    }
  };

  const deleteSubject = async (subjectId: string): Promise<void> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error("Admin access required"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
        .eq('school_id', currentSchool.id);

      if (deleteError) throw deleteError;

      setSubjects(prev => prev.filter(subject => subject.id !== subjectId));
      setLoading(false);
    } catch (e) {
      setError(e as Error);
      console.error('Error deleting subject:', e);
      setLoading(false);
    }
  };

  return (
    <SubjectsContext.Provider value={{
      subjects,
      fetchSubjects,
      createSubject,
      updateSubject,
      deleteSubject,
      loading,
      error
    }}>
      {children}
    </SubjectsContext.Provider>
  );
};

export { SubjectsProvider, SubjectsContext };

export const useSubjects = () => {
  const context = useContext(SubjectsContext);
  if (context === undefined) {
    throw new Error('useSubjects must be used within a SubjectsProvider');
  }
  return context;
}; 