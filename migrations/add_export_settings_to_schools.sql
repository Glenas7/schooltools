-- Migration: Add export settings to schools table
-- Adds fields for configuring lesson export to Google Sheets

-- Add export Google Sheet URL field
ALTER TABLE schools 
ADD COLUMN export_google_sheet_url text;

-- Add export Google Sheet tab name field (default to 'lessons')
ALTER TABLE schools 
ADD COLUMN export_google_sheet_tab text DEFAULT 'lessons';

-- Add auto export frequency field with check constraint
ALTER TABLE schools 
ADD COLUMN auto_export_frequency text CHECK (auto_export_frequency IN ('none', 'hourly', 'daily', 'weekly')) DEFAULT 'none';

-- Add comments for documentation
COMMENT ON COLUMN schools.export_google_sheet_url IS 'URL of Google Sheet for exporting lessons data';
COMMENT ON COLUMN schools.export_google_sheet_tab IS 'Name of the sheet tab to export lessons to';
COMMENT ON COLUMN schools.auto_export_frequency IS 'Frequency for automatic lesson exports: none, hourly, daily, weekly'; 