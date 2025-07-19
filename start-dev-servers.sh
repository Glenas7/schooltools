#!/bin/bash

echo "🚀 Starting Development Servers for Multi-Subdomain Setup"
echo "============================================================"

# Kill any existing processes on the ports we need
echo "🧹 Cleaning up existing processes..."
pkill -f "vite.*8081" 2>/dev/null || true
pkill -f "vite.*3001" 2>/dev/null || true
sleep 2

# Check if .env files exist and have anon key configured
if ! grep -q "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" .env 2>/dev/null; then
    echo "❌ ERROR: Please update your .env file with your Supabase anon key first!"
    echo "   1. Go to https://supabase.com/dashboard"
    echo "   2. Select your project"
    echo "   3. Go to Settings → API"
    echo "   4. Copy the 'anon public' key"
    echo "   5. Replace 'your_supabase_anon_key_here' in .env files"
    exit 1
fi

echo "✅ Environment files configured"

# Function to start server in background
start_server() {
    local name=$1
    local port=$2
    local dir=$3
    local log_file="/tmp/${name}-dev.log"
    
    echo "🚀 Starting $name on port $port..."
    cd "$dir"
    npm run dev -- --port $port > "$log_file" 2>&1 &
    local pid=$!
    echo "   PID: $pid, Logs: $log_file"
    cd - > /dev/null
    
    # Wait a moment and check if it started successfully
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        echo "   ✅ $name started successfully"
    else
        echo "   ❌ $name failed to start. Check logs: $log_file"
    fi
}

# Start Central Hub (port 8081)
start_server "Central Hub" 8081 "apps/central-hub"

# Start Scheduler Module (port 3001)  
start_server "Scheduler Module" 3001 "apps/scheduler-module"

echo ""
echo "🎉 Development servers are running:"
echo "   📊 Central Hub:      http://localhost:8081"
echo "   📅 Scheduler Module: http://localhost:3001"
echo ""
echo "📝 Testing checklist:"
echo "   1. Login at http://localhost:8081"
echo "   2. Select a school"
echo "   3. Click 'Scheduler' module"
echo "   4. Verify it navigates to localhost:3001 with school context"
echo "   5. Test 'Back to Central Hub' button"
echo ""
echo "🛑 To stop servers: pkill -f 'vite.*8081|vite.*3001'"
echo "📊 View logs: tail -f /tmp/central-hub-dev.log"
echo "📊 View logs: tail -f /tmp/scheduler-module-dev.log" 