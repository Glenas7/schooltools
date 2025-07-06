# Automated Export Setup Guide

This guide explains how to configure automated lesson exports to Google Sheets using the built-in cron job system.

## How It Works

The automated export system uses PostgreSQL's `pg_cron` extension to schedule recurring exports based on the `auto_export_frequency` setting for each school:

- **Hourly**: Exports run every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
- **Daily**: Exports run every day at 2:00 AM
- **Weekly**: Exports run every Sunday at 2:00 AM
- **None**: No automated exports (manual only)

## Automatic Management

The system automatically manages cron jobs:

✅ **Creates** cron jobs when users set an export frequency (other than "none")  
✅ **Updates** cron jobs when users change the export frequency  
✅ **Removes** cron jobs when users set frequency to "none" or delete/deactivate schools  
✅ **Logs** all export attempts (both manual and automated) in the `export_logs` table  

## Production Configuration

### Required Database Settings

For automated exports to work in production, you need to configure the service role key as a database setting:

```sql
-- Set the service role key for automated exports
ALTER DATABASE postgres SET app.supabase_service_role_key TO 'your_service_role_key_here';

-- Optional: Set a custom Supabase URL (defaults to the current project URL)
ALTER DATABASE postgres SET app.supabase_url TO 'https://your-project.supabase.co';
```

### Setting Up in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **Database**
3. In the **Connection pooling** section, add these settings to **Custom postgres config**:

```
app.supabase_service_role_key = 'your_service_role_key_here'
```

**⚠️ Security Note**: The service role key should be kept secure. In production environments, consider using Supabase's built-in secrets management or environment variables.

## Monitoring Exports

Users can monitor their exports through the **Settings** page:

- **Export History**: Shows the last 10 export attempts with status and timestamps
- **Automated Export Status**: Displays current auto-export frequency setting
- **Real-time Logs**: Refreshable export log viewer

## Database Schema

The automated export system creates:

### Tables
- `export_logs`: Tracks all export attempts with status and error information

### Functions
- `export_lessons_via_http()`: Makes HTTP requests to the export edge function
- `manage_export_cron_job()`: Manages cron job creation/deletion for schools
- `handle_export_frequency_change()`: Trigger function for auto-managing cron jobs
- `admin_manage_school_export_schedule()`: Admin function for managing export schedules

### Triggers
- Automatically creates/updates/removes cron jobs when `auto_export_frequency` changes
- Cleans up cron jobs when schools are deleted or deactivated

## Troubleshooting

### Common Issues

1. **"Service role key not configured" error**
   - Solution: Configure the database setting as described above

2. **Exports not running automatically**
   - Check if `auto_export_frequency` is set to something other than "none"
   - Verify the cron job exists: `SELECT * FROM cron.job;`
   - Check export logs for error messages

3. **Permission errors in automated exports**
   - Ensure the Google service account has edit access to the target sheet
   - Verify the export Google Sheet URL is configured correctly

### Checking Cron Jobs

To view all scheduled export jobs:

```sql
SELECT 
    jobname,
    schedule,
    command,
    active
FROM cron.job 
WHERE jobname LIKE 'export_lessons_%';
```

### Viewing Export Logs

To check recent export attempts:

```sql
SELECT 
    school_id,
    export_type,
    status,
    error_message,
    created_at
FROM export_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

## Manual Management

Admins can manually manage export schedules using the database function:

```sql
-- Example: Set a school to daily exports
SELECT admin_manage_school_export_schedule(
    'school-uuid-here'::uuid, 
    'daily'
);
```

## Security Considerations

- Export functionality is restricted to admin and superadmin users only
- Row Level Security (RLS) is enabled on the `export_logs` table
- Service role key should be configured securely in production
- All database functions use `SECURITY DEFINER` for controlled access

## Benefits

✅ **Zero-maintenance**: Automatically manages cron jobs based on user settings  
✅ **Self-cleaning**: Removes unused cron jobs when schools change settings  
✅ **Transparent**: Full logging and monitoring capabilities  
✅ **Secure**: Proper permission checks and RLS policies  
✅ **Flexible**: Supports multiple export frequencies per school 