# 🚀 Production Setup Guide for Automated Exports

This guide provides **clear, step-by-step instructions** for setting up automated lesson exports in your production environment.

## ✅ **What's Already Done**

The automated export system is **fully implemented** and ready to use. Here's what's already working:

- ✅ Database schema with automated cron job management
- ✅ Edge function for exporting lessons to Google Sheets  
- ✅ Frontend UI for configuration and monitoring
- ✅ Secure secrets management system
- ✅ Export logging and history tracking

## 🔧 **Production Setup Steps**

🎉 **Great news!** The automated export system is **ready to use immediately** - no additional setup required!

### ✅ **What's Already Configured:**

- ✅ **Service Role Key**: Automatically available as `SUPABASE_SERVICE_ROLE_KEY` environment variable
- ✅ **Edge Functions**: Deployed and ready to handle exports
- ✅ **Database Schema**: All tables and functions are set up
- ✅ **Automated Scheduling**: Cron jobs are automatically managed

### 🚀 **Ready to Use!**

All schools can immediately:
- Configure Google Sheet URLs and tab names
- Set up automated export schedules (hourly/daily/weekly)
- Perform manual exports
- View export history and logs

### **Test the Setup**

1. As an **admin or superadmin**, scroll down to the **"Export Lessons"** section
2. Configure a Google Sheet URL and tab name
3. Select an auto-export frequency (hourly/daily/weekly)
4. Click **"Save Settings"**
5. Test with **"Export Now"** to verify it works

## 📋 **User Instructions**

### **For App Creator (You):**
- No setup required - system is ready to use
- Monitor usage across all schools

### **For School Admins:**
- Configure Google Sheet settings for their school
- Set up automated export schedules
- Monitor export history and logs

### **For Teachers:**
- No additional setup required
- Lessons are automatically exported based on admin settings

## 🔍 **Verification Steps**

### **Check if Setup is Working:**

1. **Service Role Key Status**: 
   - System is configured once by app creator
   - All admins can use automated export options immediately

2. **Test Manual Export**:
   - Configure a Google Sheet URL
   - Click "Export Now"
   - Check the "Export History" section for success status

3. **Verify Automated Scheduling**:
   - Set an auto-export frequency
   - Check that a cron job was created (visible in export logs after the scheduled time)

### **Database Verification (Optional)**:

You can verify the setup directly in the database:

```sql
-- Check active cron jobs
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE 'export_lessons_%';

-- Check recent export logs
SELECT school_id, export_type, status, created_at 
FROM export_logs 
ORDER BY created_at DESC 
LIMIT 5;
```

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **"Missing Google Sheets Service Account credentials" error**
   - **Solution**: Ensure GOOGLE_SHEETS_PRIVATE_KEY and GOOGLE_SHEETS_CLIENT_EMAIL environment variables are set

2. **Automated exports not working**
   - **Solution**: Check that auto-export frequency is set to something other than "none"

3. **Manual exports work but automated exports don't**
   - **Check**: Auto-export frequency is set to something other than "none"
   - **Check**: Google Sheet URL is properly configured
   - **Check**: Export logs for specific error messages

4. **Google Sheets permission errors**
   - **Solution**: Share your Google Sheet with: `schooltools@schooltools-459418.iam.gserviceaccount.com`
   - **Make sure**: The service account has "Editor" access

### **Getting Help:**

- **Export History**: Check the "Export History" section in Settings for error details
- **Database Logs**: Use the verification queries above to check system status
- **Supabase Logs**: Check your Supabase project logs for detailed error information

## 🔒 **Security Notes**

- ✅ Service role key is stored securely in the database with RLS policies
- ✅ Only superadmin users can configure the service role key
- ✅ Only admin/superadmin users can access export functionality
- ✅ All export attempts are logged for audit purposes

## 📊 **Export Schedules**

- **Hourly**: Every hour at minute 0 (1:00, 2:00, 3:00...)
- **Daily**: Every day at 2:00 AM
- **Weekly**: Every Sunday at 2:00 AM
- **Manual**: Available anytime for immediate export

## 🎯 **Success Indicators**

You'll know the setup is working when:

✅ System is ready immediately (no setup required)  
✅ All school admins can select auto-export frequencies  
✅ Manual exports complete successfully  
✅ Export history shows successful automated exports  
✅ Google Sheets receive updated lesson data automatically  

---

## 📞 **Need Help?**

If you encounter issues not covered in this guide:

1. Check the **Export History** section for specific error messages
2. Verify all steps above were completed correctly
3. Test with a simple Google Sheet first to isolate issues
4. Check that your Google service account has proper permissions

The system is designed to be self-managing once configured correctly. Most issues are related to missing service role key configuration or Google Sheets permissions. 