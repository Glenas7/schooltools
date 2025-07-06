#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment process for music.schooltools.online"

# Step 1: Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
else
  echo "📦 Dependencies already installed, skipping..."
fi

# Step 2: Build the application
echo "🏗️ Building application..."
npm run build

# Step 3: Deploy Supabase functions if Supabase CLI is installed
if command -v supabase &> /dev/null; then
  echo "🔧 Deploying Supabase Edge Functions..."
  supabase functions deploy get-google-sheet-lessons
  supabase functions deploy public-get-students
  supabase functions deploy export-lessons-to-sheet
  supabase functions deploy create-user
else
  echo "⚠️ Supabase CLI not found. Install with: npm install -g supabase"
  echo "⚠️ Skipping Supabase functions deployment..."
fi

# Step 4: Deploy to Vercel if Vercel CLI is installed
if command -v vercel &> /dev/null; then
  echo "🚀 Deploying to Vercel..."
  vercel --prod
else
  echo "⚠️ Vercel CLI not found. Install with: npm install -g vercel"
  echo "⚠️ Manual deployment required: Run 'vercel --prod' after installing the CLI"
fi

echo "✅ Deployment process completed!"
echo "🌐 Visit your application at: https://music.schooltools.online (after DNS propagation)"
echo "🔍 Check your deployment status in the Vercel dashboard" 