# Vercel Deployment Guide

This document outlines the steps needed to deploy the Rhythmic Lesson Orchestrator application to Vercel, with the domain configured as `music.schooltools.online`.

## Step 1: Prepare Your Project

Your project is already set up with the necessary configuration files:
- `package.json` with build scripts
- `vercel.json` for routing configuration
- `.github/workflows/deploy.yml` for continuous deployment

## Step 2: GitHub Repository Setup

1. Create a GitHub repository for your project if you haven't already
2. Push your code to the repository:
   ```
   git init
   git add .
   git commit -m "Initial commit for Vercel deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/rhythmic-lesson-orchestrator.git
   git push -u origin main
   ```

## Step 3: Vercel Deployment

1. Log in to your Vercel account at https://vercel.com
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Vite
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `dist`

## Step 4: Environment Variables Configuration

Add the following environment variables in the Vercel project settings:

```
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Sheets API (for Edge Functions)
GOOGLE_SHEETS_PRIVATE_KEY=your_private_key  
GOOGLE_SHEETS_CLIENT_EMAIL=your_client_email
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_SHEET_NAME_AND_RANGE=Sheet1!A2:A
```

**Note**: For `GOOGLE_SHEETS_PRIVATE_KEY`, ensure it's properly formatted with newlines. If you copy from a JSON file, replace `\n` with actual newlines.

## Step 5: Configure GitHub Actions (Optional)

For continuous deployment through GitHub Actions:

1. In GitHub, go to your repository's Settings > Secrets and variables > Actions
2. Add the following secrets:
   - `VERCEL_TOKEN`: Your Vercel API token (from Vercel account settings)
   - `VERCEL_ORG_ID`: Your Vercel organization ID 
   - `VERCEL_PROJECT_ID`: Your Vercel project ID
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

3. The workflow file is already configured in `.github/workflows/deploy.yml`
4. After adding these secrets, any push to the main branch will trigger an automatic deployment

## Step 6: Deploy

1. Click "Deploy" to start the deployment process
2. Vercel will build and deploy your application

## Step 7: Domain Configuration

1. In your Vercel project dashboard, navigate to "Settings" > "Domains"
2. Click "Add Domain"
3. Enter `music.schooltools.online` as your domain
4. Choose how you want to add the domain:
   - Add as a subdomain of your Namecheap domain

## Step 8: Configure DNS in Namecheap

1. Log in to your Namecheap account
2. Go to "Domain List" and select "schooltools.online"
3. Click "Manage" > "Advanced DNS"
4. Add a CNAME record:
   - Type: CNAME
   - Host: music
   - Value: cname.vercel-dns.com.
   - TTL: Automatic
5. Save your changes

## Step 9: Verify Domain

1. Return to Vercel and click "Verify" in the domain settings
2. Wait for DNS propagation (can take up to 48 hours, but usually much faster)

## Step 10: Configure Supabase Edge Functions

Your application uses Supabase Edge Functions for fetching data from Google Sheets. These need to be properly configured:

1. Make sure you have the Supabase CLI installed and set up
   ```
   npm install -g supabase
   supabase login
   ```

2. Deploy the Edge Functions to your Supabase project
   ```
   supabase functions deploy get-google-sheet-lessons
   supabase functions deploy public-get-students
   ```

3. Configure environment variables for the Edge Functions in the Supabase dashboard:
   - Go to your Supabase project dashboard
   - Navigate to Settings > API > Edge Functions
   - Add the following environment variables:
     ```
     GOOGLE_SHEETS_API_KEY=your_google_api_key
     GOOGLE_SHEETS_PRIVATE_KEY=your_private_key  
     GOOGLE_SHEETS_CLIENT_EMAIL=your_client_email
     GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
     GOOGLE_SHEETS_SHEET_NAME_AND_RANGE=Sheet1!A2:A
     ```

4. Ensure CORS is properly configured for your deployed frontend:
   - In the Supabase dashboard, go to Settings > API
   - Add your Vercel domain to the "Additional allowed CORS origins":
     ```
     https://music.schooltools.online
     ```

## Step 11: Final Checks

1. Visit `music.schooltools.online` to ensure your app is deployed correctly
2. Test all functionality to verify everything works as expected
3. Check that Supabase and Google Sheets integrations are working properly

If you encounter issues with Supabase Edge Functions, check the function logs in the Supabase dashboard for error details. 