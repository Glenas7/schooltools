// Follow Deno and Oak conventions for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sheets_v4 } from "npm:@googleapis/sheets";
import { GoogleAuth } from "npm:google-auth-library";

// Type definition for sheet lessons
type SheetLesson = {
  studentName: string;
  duration: number | string;
  teacher: string;
  startDate: string;
  instrument: string;
};

// Handle the Google Sheets API request using Service Account
async function fetchGoogleSheetLessons(supabase: any, schoolId: string): Promise<SheetLesson[]> {
  try {
    // Get Google Sheets credentials from environment variables
    const privateKey = Deno.env.get("GOOGLE_SHEETS_PRIVATE_KEY");
    const clientEmail = Deno.env.get("GOOGLE_SHEETS_CLIENT_EMAIL");
    
    if (!privateKey || !clientEmail) {
      throw new Error('Missing Google Sheets Service Account credentials');
    }
    
    // Get school-specific Google Sheets configuration from database
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('google_sheet_lessons_url, google_sheet_lessons_name, google_sheet_lessons_range')
      .eq('id', schoolId)
      .single();

    if (schoolError) {
      throw new Error(`Error fetching school configuration: ${schoolError.message}`);
    }

    if (!schoolData?.google_sheet_lessons_url) {
      throw new Error('Google Sheets lessons URL not configured for this school');
    }

    // Extract spreadsheet ID from the URL
    const spreadsheetId = extractSpreadsheetId(schoolData.google_sheet_lessons_url);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets lessons URL format');
    }
    
    // Use school-specific sheet name and range or defaults
    const sheetName = schoolData.google_sheet_lessons_name || 'lessons';
    const range = schoolData.google_sheet_lessons_range || 'A1:E1000';
    const fullRange = `${sheetName}!${range}`;
    
    // Set up Service Account authentication
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
    
    const auth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const client = await auth.getClient();
    const sheets = new sheets_v4.Sheets({ auth: client });

    // Fetch data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
    });
    
    const values = response.data.values;
    
    if (!values || !Array.isArray(values) || values.length < 2) {
      throw new Error('Invalid or empty Google Sheets data');
    }
    
    // Extract headers and data
    const [headers, ...rows] = values;
    
    if (headers.length < 5) {
      throw new Error('Invalid Google Sheets headers: expected at least 5 columns');
    }
    
    // Transform the rows into objects with appropriate column names
    return rows
      .filter(row => row.length >= 5 && row[0]?.trim()) // Ensure the row has data and student name
      .map(row => {
        return {
          studentName: row[0]?.trim() || '',
          // Parse duration as number if possible, otherwise keep as string
          duration: parseInt(row[1], 10) || row[1] || '',
          teacher: row[2]?.trim() || '',
          startDate: row[3]?.trim() || '',
          instrument: row[4]?.trim() || ''
        };
      });
  } catch (error) {
    console.error('Error fetching Google Sheet lessons:', error);
    throw error;
  }
}

// Function to extract spreadsheet ID from various Google Sheets URL formats
function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  
  // Handle different Google Sheets URL formats
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,  // Standard format
    /\/d\/([a-zA-Z0-9-_]+)/,               // Shortened format
    /id=([a-zA-Z0-9-_]+)/,                 // Query parameter format
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Create the Supabase client
const createSupabaseClient = (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
};

// The main serve function that handles requests
serve(async (req: Request) => {
  // Enable CORS
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  });
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }
  
  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers, status: 405 }
    );
  }
  
  try {
    // Get the authorization header
    if (!req.headers.get('Authorization')) {
      throw new Error('No authorization header');
    }
    
    // Create Supabase client to validate auth
    const supabase = createSupabaseClient(req);
    
    // Verify that the user is authenticated and admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers, status: 401 }
      );
    }
    
    // Get school ID from request body
    const { school_id } = await req.json();
    
    if (!school_id) {
      return new Response(
        JSON.stringify({ error: 'Missing school_id parameter' }),
        { headers, status: 400 }
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
        { headers, status: 403 }
      );
    }
    
    // Fetch the Google Sheet data
    const lessons = await fetchGoogleSheetLessons(supabase, school_id);
    
    // Return the lessons
    return new Response(
      JSON.stringify(lessons),
      { headers, status: 200 }
    );
  } catch (error) {
    console.error('Error in function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers, status: 500 }
    );
  }
}); 