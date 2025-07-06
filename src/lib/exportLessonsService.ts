import { supabase } from './supabaseClient';

export interface ExportLessonsResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Export lessons to Google Sheets for a specific school
 */
export const exportLessonsToSheet = async (schoolId: string): Promise<ExportLessonsResult> => {
  try {
    console.log('Starting lesson export for school:', schoolId);
    
    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('export-lessons-to-sheet', {
      method: 'POST',
      body: JSON.stringify({ school_id: schoolId })
    });
    
    if (error) {
      console.error('Export function error:', error);
      throw new Error(error.message || 'Failed to export lessons');
    }
    
    console.log('Export completed successfully:', data);
    
    return {
      success: true,
      message: data?.message || 'Lessons exported successfully'
    };
  } catch (err) {
    console.error('Error exporting lessons:', err);
    
    return {
      success: false,
      message: 'Failed to export lessons',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
};

/**
 * Update export settings for a school
 */
export const updateExportSettings = async (
  schoolId: string,
  settings: {
    export_google_sheet_url?: string;
    export_google_sheet_tab?: string;
    auto_export_frequency?: 'none' | 'hourly' | 'daily' | 'weekly';
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('schools')
      .update(settings)
      .eq('id', schoolId);
      
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (err) {
    console.error('Error updating export settings:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}; 