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
const exportLessonsToSheet = async (schoolId: string): Promise<void> => {
  console.log('Starting lesson export for school:', schoolId);
  
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
    .select('export_google_sheet_url, export_google_sheet_tab')
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
  console.log('Export configuration:', { spreadsheetId, sheetTab });
  
  // Fetch all lessons with related data
  const { data: lessons, error: lessonsError } = await supabase
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
    .eq('school_id', schoolId)
    .order('student_name');
    
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
  
  try {
    // Verify authentication
    if (!req.headers.get('Authorization')) {
      throw new Error('No authorization header');
    }
    
    const supabase = createSupabaseClient(req);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: corsHeaders, status: 401 }
      );
    }
    
    // Get school ID from request body
    const { school_id } = await req.json();
    
    if (!school_id) {
      return new Response(
        JSON.stringify({ error: 'Missing school_id parameter' }),
        { headers: corsHeaders, status: 400 }
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
    
    // Perform the export
    await exportLessonsToSheet(school_id);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Lessons exported successfully' }),
      { headers: corsHeaders, status: 200 }
    );
  } catch (error) {
    console.error('Error in export function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: corsHeaders, status: 500 }
    );
  }
}); 