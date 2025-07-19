# Quick Deployment Commands & URLs

## GitHub Repository Setup

### 1. Create Backup Repository
```bash
# Replace YOUR_USERNAME with your GitHub username
# Replace CURRENT_REPO with your current production repository name

git clone https://github.com/YOUR_USERNAME/CURRENT_REPO.git scheduler-backup
cd scheduler-backup
git remote set-url origin https://github.com/YOUR_USERNAME/school-scheduler-standalone-backup.git
git push -u origin main
```

### 2. Create New Production Repository
```bash
# In your current project directory
git remote add production https://github.com/YOUR_USERNAME/school-scheduler-multi-module.git
git push -u production main
```

## Environment Variables

### Central Hub (.env)
```bash
VITE_SUPABASE_URL=https://xetfugvbiewwhpsxohne.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
VITE_CENTRAL_HUB_URL=https://app.schooltools.online
VITE_CURRENT_SUBDOMAIN=app
VITE_SCHEDULER_URL=https://scheduler.schooltools.online
NODE_ENV=production
```

### Scheduler Module (.env)
```bash
VITE_SUPABASE_URL=https://xetfugvbiewwhpsxohne.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
VITE_CENTRAL_HUB_URL=https://app.schooltools.online
VITE_CURRENT_SUBDOMAIN=scheduler
VITE_MODULE_NAME=scheduler
VITE_MODULE_DISPLAY_NAME=Lesson Scheduler
NODE_ENV=production
```

## Local Testing Commands

### Start Development Servers
```bash
# From project root
./start-dev-servers.sh

# Or manually:
cd apps/central-hub && npm run dev -- --port 8081 &
cd apps/scheduler-module && npm run dev -- --port 3001 &
```

### Build Both Apps
```bash
# From project root
cd apps/central-hub && npm run build
cd apps/scheduler-module && npm run build
```

## Vercel Project Configuration

### Central Hub Project
- **Project Name**: `school-scheduler-central-hub`
- **Framework**: Vite
- **Root Directory**: `apps/central-hub`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Domain**: `app.schooltools.online`

### Scheduler Module Project
- **Project Name**: `school-scheduler-module`
- **Framework**: Vite
- **Root Directory**: `apps/scheduler-module`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Domain**: `scheduler.schooltools.online`

## DNS Configuration (Namecheap)

### CNAME Records to Add
```
Type: CNAME | Host: app | Value: cname.vercel-dns.com | TTL: Automatic
Type: CNAME | Host: scheduler | Value: cname.vercel-dns.com | TTL: Automatic
```

## Testing URLs

### Development
- Central Hub: http://localhost:8081
- Scheduler Module: http://localhost:3001

### Production
- Central Hub: https://app.schooltools.online
- Scheduler Module: https://scheduler.schooltools.online

## GitHub Secrets Needed

For automated deployments, add these secrets to your GitHub repository:

```
VITE_SUPABASE_URL=https://xetfugvbiewwhpsxohne.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_CENTRAL_HUB_PROJECT_ID=central_hub_project_id
VERCEL_SCHEDULER_PROJECT_ID=scheduler_project_id
```

## Emergency Rollback

### Quick Rollback to Previous Scheduler
1. In Vercel, go to your old scheduler project
2. Add `scheduler.schooltools.online` back to domains
3. Remove domain from new scheduler-module project

### Full Rollback
1. Remove new CNAME records from DNS
2. Restore old domain configurations
3. Notify users of maintenance 