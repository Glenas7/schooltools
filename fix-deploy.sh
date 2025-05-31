#!/bin/bash

# Exit on error
set -e

echo "🔧 Fixing deployment configuration..."

# Clean any previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build with updated configuration
echo "🏗️ Building application with updated configuration..."
npm run build

# Deploy to production with the fixed configuration
echo "🚀 Deploying to Vercel production..."
vercel --prod

echo "✅ Deployment completed!"
echo "🌐 If you're still experiencing MIME type issues:"
echo "1. Check that your vercel.json has the correct headers configuration"
echo "2. Make sure your Vite config has the proper output format settings"
echo "3. Visit the Vercel dashboard to check for any build errors"
echo "🔍 Check your deployment at https://music.schooltools.online once DNS is configured" 