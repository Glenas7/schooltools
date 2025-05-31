// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { sheets_v4 } from "npm:@googleapis/sheets";
import { GoogleAuth } from "npm:google-auth-library";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// CORS headers to allow requests from any origin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
};

// Log helper function
const log = (message: string, obj?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (obj) {
    console.log(JSON.stringify(obj, null, 2));
  }
};

// Extract spreadsheet ID from various Google Sheets URL formats
const extractSpreadsheetId = (url: string): string | null => {
  try {
    // Handle different Google Sheets URL formats
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /\/d\/([a-zA-Z0-9-_]+)/,
      /^([a-zA-Z0-9-_]+)$/ // Direct ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    log("Error extracting spreadsheet ID:", error);
    return null;
  }
};

serve(async (req: Request) => {
  log("Function invoked with method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    log("Handling OPTIONS request");
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Mock student names as fallback
  const mockStudentNames = [
    "Alice Smith",
    "Bob Johnson", 
    "Charlie Williams",
    "David Brown",
    "Eva Jones",
    "Frank Miller",
    "Grace Davis",
    "Henry Wilson",
    "Iris Moore",
    "Jack Taylor",
    "Kate Anderson",
    "Leo Thomas",
    "Mia Jackson",
    "Noah White",
    "Olivia Harris",
    "Peter Martin",
    "Quinn Lee",
    "Ryan Thompson",
    "Sophia Clark",
    "Tyler Lewis"
  ];

  try {
    // Parse request body to get school_id
    let schoolId: string | null = null;
    
    try {
      const body = await req.json();
      schoolId = body.school_id;
      log("Received school_id:", schoolId);
    } catch (parseError) {
      log("No JSON body provided or invalid JSON");
      return new Response(
        JSON.stringify({ error: "school_id parameter is required" }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    if (!schoolId) {
      log("No school_id provided");
      return new Response(
        JSON.stringify({ error: "school_id parameter is required" }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Fetch school's Google Sheets configuration from database
    log("Fetching school's Google Sheets configuration from database");
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('google_sheet_url, google_sheet_name, google_sheet_range')
      .eq('id', schoolId)
      .eq('active', true)
      .single();

    if (schoolError || !school) {
      log("School not found or error fetching school:", schoolError);
      return new Response(
        JSON.stringify({ error: "School not found" }),
        { 
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    const googleSheetUrl = school.google_sheet_url;
    const sheetName = school.google_sheet_name || 'Sheet1';
    const sheetRange = school.google_sheet_range || 'A2:A';
    
    log("Retrieved Google Sheet configuration:", {
      url: googleSheetUrl,
      sheetName,
      sheetRange
    });

    if (!googleSheetUrl) {
      log("No Google Sheet URL configured for this school, returning mock data");
      return new Response(
        JSON.stringify(mockStudentNames),
        { 
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    // Extract spreadsheet ID from the URL
    const spreadsheetId = extractSpreadsheetId(googleSheetUrl);
    if (!spreadsheetId) {
      log("Invalid Google Sheets URL format, returning mock data");
      return new Response(
        JSON.stringify(mockStudentNames),
        { 
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    log("Extracted spreadsheet ID:", spreadsheetId);
    
    // Check if Google Sheets credentials are available
    const privateKey = Deno.env.get("GOOGLE_SHEETS_PRIVATE_KEY");
    const clientEmail = Deno.env.get("GOOGLE_SHEETS_CLIENT_EMAIL");
    
    // Build the range using sheet name and range from database
    const fullRange = `${sheetName}!${sheetRange}`;
    
    log(`Google Sheets config:
      privateKey exists: ${Boolean(privateKey)} 
      clientEmail exists: ${Boolean(clientEmail)}
      spreadsheetId: ${spreadsheetId}
      fullRange: ${fullRange}`
    );

    let studentNames: string[] = [];

    if (privateKey && clientEmail) {
      try {
        log("Credentials found, setting up Google Sheets auth");
        const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
        
        // Authenticate with Google Sheets API
        const auth = new GoogleAuth({
          credentials: {
            client_email: clientEmail,
            private_key: formattedPrivateKey,
          },
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });

        log("Getting auth client");
        const client = await auth.getClient();
        
        log("Creating Sheets client");
        const sheets = new sheets_v4.Sheets({ auth: client });

        // Fetch data from the sheet
        log(`Fetching data from spreadsheet: ${spreadsheetId}, range: ${fullRange}`);
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: fullRange,
        });
        
        log("Google Sheets API response received");

        const values = response.data.values;
        if (values && values.length) {
          studentNames = values.flat().filter(name => typeof name === 'string' && name.trim() !== '');
          log(`Successfully retrieved ${studentNames.length} student names from Google Sheets`);
        } else {
          log("No student names found in Google Sheets, using mock data");
          studentNames = mockStudentNames;
        }
      } catch (sheetError) {
        log("Error fetching from Google Sheets, using mock data:", sheetError);
        studentNames = mockStudentNames;
      }
    } else {
      log("Missing Google Sheets credentials, using mock data instead");
      studentNames = mockStudentNames;
    }

    log(`Returning ${studentNames.length} student names`);
    return new Response(
      JSON.stringify(studentNames),
      { 
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    log("Unexpected error in function:", error);
    // Return mock data as fallback
    return new Response(
      JSON.stringify(mockStudentNames),
      { 
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
}); 