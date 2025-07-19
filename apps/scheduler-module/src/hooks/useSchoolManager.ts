import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useSchool } from '../contexts/SchoolContextWrapper';
import { useSchools } from '../contexts/SchoolsContextWrapper';

interface InviteUserData {
  email: string;
  name: string;
  role: 'admin' | 'teacher';
}

export const useSchoolManager = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { currentSchool, isSchoolAdmin } = useSchool();
  const { updateSchool } = useSchools();

  const inviteUser = async (userData: InviteUserData): Promise<boolean> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error('School admin access required'));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the create-user Edge Function instead of using admin API directly
      const response = await supabase.functions.invoke('create-user', {
        method: 'POST',
        body: JSON.stringify({
          email: userData.email,
          name: userData.name,
          school_id: currentSchool.id,
          role: userData.role
        })
      });

      if (response.error) {
        throw new Error(`Edge Function error: ${response.error.message}`);
      }

      if (!response.data) {
        throw new Error('No data received from user creation service');
      }

      setLoading(false);
      return true;
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Error inviting user');
      setError(error);
      console.error('Error inviting user:', error);
      setLoading(false);
      return false;
    }
  };

  const updateGoogleSheetUrl = async (url: string): Promise<boolean> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error('School admin access required'));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedSchool = await updateSchool(currentSchool.id, {
        google_sheet_url: url
      });

      if (!updatedSchool) {
        throw new Error('Failed to update school');
      }

      setLoading(false);
      return true;
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Error updating Google Sheet URL');
      setError(error);
      console.error('Error updating Google Sheet URL:', error);
      setLoading(false);
      return false;
    }
  };

  const removeUserFromSchool = async (userId: string): Promise<boolean> => {
    if (!isSchoolAdmin || !currentSchool) {
      setError(new Error('School admin access required'));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Remove legacy school-level access
      const { error: removeSchoolError } = await supabase
        .from('user_schools')
        .update({ active: false })
        .eq('user_id', userId)
        .eq('school_id', currentSchool.id);

      if (removeSchoolError) {
        console.warn('Error removing school-level access (may not exist):', removeSchoolError);
      }

      // Get scheduler module ID
      const { data: schedulerModule, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .eq('name', 'scheduler')
        .single();

      if (moduleError || !schedulerModule) {
        console.warn('Could not find scheduler module for access removal');
      } else {
        // Remove module-level access for scheduler
        const { error: removeModuleError } = await supabase
          .from('user_schools_modules')
          .update({ active: false })
          .eq('user_id', userId)
          .eq('school_id', currentSchool.id)
          .eq('module_id', schedulerModule.id);

        if (removeModuleError) {
          console.warn('Error removing module-level access (may not exist):', removeModuleError);
        }
      }

      setLoading(false);
      return true;
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Error removing user from school');
      setError(error);
      console.error('Error removing user from school:', error);
      setLoading(false);
      return false;
    }
  };

  const syncStudentsFromGoogleSheet = async (): Promise<boolean> => {
    if (!isSchoolAdmin || !currentSchool?.google_sheet_url) {
      setError(new Error('School admin access and Google Sheet URL required'));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the edge function to sync students
      const { data, error: functionError } = await supabase.functions.invoke(
        'get-google-sheet-lessons',
        {
          body: {
            school_id: currentSchool.id,
            sheet_url: currentSchool.google_sheet_url
          }
        }
      );

      if (functionError) throw functionError;

      console.log('Students synced from Google Sheet:', data);
      setLoading(false);
      return true;
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Error syncing students from Google Sheet');
      setError(error);
      console.error('Error syncing students:', error);
      setLoading(false);
      return false;
    }
  };

  return {
    loading,
    error,
    inviteUser,
    updateGoogleSheetUrl,
    removeUserFromSchool,
    syncStudentsFromGoogleSheet
  };
}; 