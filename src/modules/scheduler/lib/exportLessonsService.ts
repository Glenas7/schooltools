import { supabase } from '@/core/lib/supabaseClient';

export interface ExportSettings {
  export_google_sheet_url?: string | null;
  export_google_sheet_tab?: string;
  auto_export_frequency?: 'disabled' | 'daily' | 'weekly' | 'monthly';
  export_active_lessons_only?: boolean;
  export_schedule_time?: string;
  export_schedule_day?: string;
  export_timezone?: string;
}

export interface ExportResult {
  success: boolean;
  message: string;
  exportedCount?: number;
  errors?: string[];
}

export const exportLessonsToSheet = async (schoolId: string): Promise<ExportResult> => {
  try {
    console.log('Starting lesson export for school:', schoolId);

    // Get school's export settings
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('export_google_sheet_url, export_google_sheet_tab, export_active_lessons_only')
      .eq('id', schoolId)
      .single();

    if (schoolError) {
      throw new Error(`Error fetching school settings: ${schoolError.message}`);
    }

    if (!school?.export_google_sheet_url) {
      return {
        success: false,
        message: 'No Google Sheet URL configured for export'
      };
    }

    // Call the Supabase Edge Function to export lessons to Google Sheets
    console.log('Calling export Edge Function...');
    
    const response = await supabase.functions.invoke('export-lessons-to-sheet', {
      method: 'POST',
      body: JSON.stringify({ 
        school_id: schoolId,
        source: 'manual' // Mark as manual export vs automated
      })
    });
    
    console.log('Export Edge Function response:', {
      hasError: response.error !== null,
      errorMessage: response.error ? response.error.message : null,
      data: response.data
    });
    
    if (response.error) {
      console.error('Error from Export Edge Function:', response.error);
      throw new Error(`Export Edge Function error: ${response.error.message}`);
    }
    
    if (!response.data || !response.data.success) {
      throw new Error('Export Edge Function did not return success');
    }
    
    // Update the last export timestamp
    await supabase
      .from('schools')
      .update({ 
        last_export_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', schoolId);

    return {
      success: true,
      message: response.data.message || 'Successfully exported lessons to Google Sheets'
    };

  } catch (error) {
    console.error('Error exporting lessons:', error);
    return {
      success: false,
      message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

export const updateExportSettings = async (
  schoolId: string, 
  settings: ExportSettings
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Updating export settings for school:', schoolId);

    const { error } = await supabase
      .from('schools')
      .update({
        ...settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', schoolId);

    if (error) {
      throw new Error(`Error updating export settings: ${error.message}`);
    }

    return {
      success: true,
      message: 'Export settings updated successfully'
    };

  } catch (error) {
    console.error('Error updating export settings:', error);
    return {
      success: false,
      message: `Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

export const calculateNextExportTime = (
  frequency: string = 'disabled',
  scheduleTime: string = '09:00',
  scheduleDay: string = 'monday',
  timezone: string = 'UTC'
): Date => {
  const now = new Date();

  if (frequency === 'disabled') {
    return now;
  }

  try {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const nextExport = new Date(now);

    switch (frequency) {
      case 'daily':
        nextExport.setHours(hours, minutes, 0, 0);
        if (nextExport <= now) {
          nextExport.setDate(nextExport.getDate() + 1);
        }
        break;

      case 'weekly':
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = daysOfWeek.indexOf(scheduleDay.toLowerCase());
        const currentDay = nextExport.getDay();
        
        let daysUntilTarget = targetDay - currentDay;
        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7;
        }
        
        nextExport.setDate(nextExport.getDate() + daysUntilTarget);
        nextExport.setHours(hours, minutes, 0, 0);
        break;

      case 'monthly':
        nextExport.setMonth(nextExport.getMonth() + 1, 1);
        nextExport.setHours(hours, minutes, 0, 0);
        break;

      default:
        return now;
    }

    return nextExport;

  } catch (error) {
    console.error('Error calculating next export time:', error);
    return now;
  }
};

export const formatNextExportTime = (
  date: Date,
  timezone: string = 'UTC'
): string => {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting export time:', error);
    return date.toLocaleString();
  }
};