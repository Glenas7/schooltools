import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sheets_v4 } from "npm:@googleapis/sheets";
import { GoogleAuth } from "npm:google-auth-library";

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey'
};

// Type definitions
interface LessonExportData {
  student_name: string;
  duration: number;
  subject_name: string;
  teacher_name: string | null;
  location_name: string | null;
  day_of_week: string;
  start_time: string | null;
  start_date: string | null;
  end_date: string | null;
}

// Helper function to convert day number to day name
const getDayName = (dayNumber: number | null): string => {
  if (dayNumber === null) return 'Not scheduled';
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayNumber] || 'Invalid day';
};

// Helper function to extract spreadsheet ID from URL
const extractSpreadsheetId = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]+)$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// Main export function
const exportLessonsToSheet = async (schoolId: string, source: string = 'manual'): Promise<void> => {
  console.log('Starting lesson export for school:', schoolId, 'source:', source);
  
  // Get Google Sheets credentials
  const privateKey = Deno.env.get("GOOGLE_SHEETS_PRIVATE_KEY");
  const clientEmail = Deno.env.get("GOOGLE_SHEETS_CLIENT_EMAIL");
  
  if (!privateKey || !clientEmail) {
    throw new Error('Missing Google Sheets Service Account credentials');
  }
  
  // Create service role Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false
    }
  });
  
  // Get school export configuration
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('export_google_sheet_url, export_google_sheet_tab, export_active_lessons_only')
    .eq('id', schoolId)
    .single();
    
  if (schoolError || !school) {
    throw new Error(`School not found or error fetching school: ${schoolError?.message}`);
  }
  
  if (!school.export_google_sheet_url) {
    throw new Error('Export Google Sheet URL not configured for this school');
  }
  
  // Extract spreadsheet ID
  const spreadsheetId = extractSpreadsheetId(school.export_google_sheet_url);
  if (!spreadsheetId) {
    throw new Error('Invalid Google Sheets URL format');
  }
  
  const sheetTab = school.export_google_sheet_tab || 'lessons';
  console.log('Export configuration:', { 
    spreadsheetId, 
    sheetTab, 
    exportActiveLessonsOnly: school.export_active_lessons_only 
  });
  
  // Build lessons query with optional active filter
  let lessonsQuery = supabase
    .from('lessons')
    .select(`
      student_name,
      duration_minutes,
      day_of_week,
      start_time,
      start_date,
      end_date,
      subjects (name),
      users (name),
      locations (name)
    `)
    .eq('school_id', schoolId);
    
  // Apply active lessons filter if enabled
  if (school.export_active_lessons_only) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    lessonsQuery = lessonsQuery
      .lte('start_date', today)
      .gt('end_date', today);
  }
  
  const { data: lessons, error: lessonsError } = await lessonsQuery.order('student_name');
    
  if (lessonsError) {
    throw new Error(`Error fetching lessons: ${lessonsError.message}`);
  }
  
  console.log(`Fetched ${lessons?.length || 0} lessons`);
  
  // Transform data for export
  const exportData: string[][] = [
    // Header row
    [
      'Student Name',
      'Duration (minutes)',
      'Subject',
      'Teacher',
      'Location',
      'Day of Week',
      'Start Time',
      'Start Date',
      'End Date'
    ]
  ];
  
  // Add lesson data rows
  if (lessons) {
    for (const lesson of lessons) {
      exportData.push([
        lesson.student_name || '',
        (lesson.duration_minutes || 0).toString(),
        lesson.subjects?.name || '',
        lesson.users?.name || 'Unassigned',
        lesson.locations?.name || 'No location',
        getDayName(lesson.day_of_week),
        lesson.start_time || 'Not scheduled',
        lesson.start_date || 'Not set',
        lesson.end_date || 'Not set'
      ]);
    }
  }
  
  console.log(`Prepared ${exportData.length - 1} lesson rows for export`);
  
  // Set up Google Sheets authentication
  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
  
  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: formattedPrivateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  
  const client = await auth.getClient();
  const sheets = new sheets_v4.Sheets({ auth: client });
  
  // Clear the sheet first
  console.log('Clearing existing data in sheet tab:', sheetTab);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetTab}!A:Z`,
  });
  
  // Write the data
  console.log('Writing lesson data to sheet');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTab}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: exportData,
    },
  });
  
  console.log('Lesson export completed successfully');
  
  // Log the export (if export_logs table exists)
  try {
    await supabase
      .from('export_logs')
      .insert({
        school_id: schoolId,
        export_type: source,
        status: 'completed'
      });
  } catch (logError) {
    console.warn('Could not log export (table may not exist):', logError);
  }
};

// Create Supabase client with user auth
const createSupabaseClient = (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
};

// Main serve function
serve(async (req: Request) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers: corsHeaders, status: 405 }
    );
  }
  
  let school_id: string | undefined;
  let source: string = 'manual';
  
  try {
    // Get request body
    const requestBody = await req.json();
    school_id = requestBody.school_id;
    source = requestBody.source || 'manual';
    
    if (!school_id) {
      return new Response(
        JSON.stringify({ error: 'Missing school_id parameter' }),
        { headers: corsHeaders, status: 400 }
      );
    }
    
    // For manual exports, verify authentication and authorization
    if (source === 'manual') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'No authorization header' }),
          { headers: corsHeaders, status: 401 }
        );
      }
      
      // Create Supabase client with user auth
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { 
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: { Authorization: authHeader }
        }
      });
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: corsHeaders, status: 401 }
        );
      }
      
      // Check if user is admin or superadmin for this school
      const { data: userSchool, error: userSchoolError } = await supabase
        .from('user_schools')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', school_id)
        .eq('active', true)
        .single();
      
      if (userSchoolError || !userSchool || (userSchool.role !== 'admin' && userSchool.role !== 'superadmin')) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Admin access required' }),
          { headers: corsHeaders, status: 403 }
        );
      }
    }
    
    // Perform the export
    await exportLessonsToSheet(school_id, source);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Lessons exported successfully' }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (error) {
    console.error('Error in export function:', error);
    
    // Try to log the error if we have school_id
    if (school_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { 
            persistSession: false,
            autoRefreshToken: false
          }
        });
        
        await supabase
          .from('export_logs')
          .insert({
            school_id,
            export_type: source,
            status: 'failed',
            error_message: error.message
          });
      } catch (logError) {
        console.warn('Could not log error:', logError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: corsHeaders, status: 500 }
    );
  }
}); 