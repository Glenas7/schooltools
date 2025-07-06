import { supabase } from './supabaseClient';

export interface ExportLessonsResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Calculate the next scheduled export time
 */
export const calculateNextExportTime = (
  frequency: 'none' | 'hourly' | 'daily' | 'weekly',
  scheduleTime: string = '09:00:00',
  scheduleDay: number = 1, // 1=Monday, 7=Sunday
  timezone: string = 'UTC'
): Date | null => {
  if (frequency === 'none') return null;
  
  const now = new Date();
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  
  if (frequency === 'hourly') {
    // Next hour
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    return nextHour;
  }
  
  if (frequency === 'daily') {
    // Next occurrence of the specified time
    const nextDaily = new Date(now);
    nextDaily.setHours(hours, minutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (nextDaily <= now) {
      nextDaily.setDate(nextDaily.getDate() + 1);
    }
    
    return nextDaily;
  }
  
  if (frequency === 'weekly') {
    // Next occurrence of the specified day and time
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const targetDay = scheduleDay === 7 ? 0 : scheduleDay; // Convert 7=Sunday to 0
    
    let daysUntilTarget = (targetDay - currentDay + 7) % 7;
    
    // If it's the same day, check if the time has passed
    if (daysUntilTarget === 0) {
      const todayAtTime = new Date(now);
      todayAtTime.setHours(hours, minutes, 0, 0);
      
      if (todayAtTime <= now) {
        daysUntilTarget = 7; // Schedule for next week
      }
    }
    
    const nextWeekly = new Date(now);
    nextWeekly.setDate(now.getDate() + daysUntilTarget);
    nextWeekly.setHours(hours, minutes, 0, 0);
    
    return nextWeekly;
  }
  
  return null;
};

/**
 * Format next export time for display
 */
export const formatNextExportTime = (nextTime: Date | null): string => {
  if (!nextTime) return 'Not scheduled';
  
  const now = new Date();
  const diffMs = nextTime.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  const timeString = nextTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  if (diffDays > 0) {
    return `${timeString} (in ${diffDays} day${diffDays > 1 ? 's' : ''})`;
  } else if (diffHours > 0) {
    return `${timeString} (in ${diffHours} hour${diffHours > 1 ? 's' : ''})`;
  } else if (diffMinutes > 0) {
    return `${timeString} (in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''})`;
  } else {
    return `${timeString} (very soon)`;
  }
};

/**
 * Export lessons to Google Sheets for a specific school
 */
export const exportLessonsToSheet = async (schoolId: string): Promise<ExportLessonsResult> => {
  try {
    console.log('Starting lesson export for school:', schoolId);
    
    // Get the current session to ensure we have auth headers
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session found. Please log in again.');
    }
    
    // Call the Supabase Edge Function with the correct body format
    const { data, error } = await supabase.functions.invoke('export-lessons-to-sheet', {
      body: { school_id: schoolId }
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
    export_active_lessons_only?: boolean;
    export_schedule_time?: string;
    export_schedule_day?: number;
    export_timezone?: string;
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