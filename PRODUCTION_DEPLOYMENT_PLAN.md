# 🚀 Production Deployment Plan: Multi-Subdomain Architecture

## Overview

This plan migrates from a single scheduler app at `scheduler.schooltools.online` to a multi-subdomain architecture:

- **`app.schooltools.online`**: Central Hub (school management, module navigation)
- **`scheduler.schooltools.online`**: Scheduler Module (replacing existing deployment)

## Pre-Deployment Checklist

✅ **Codebase Review Complete**: Multi-app monorepo structure verified  
✅ **Shared Authentication**: Cross-domain auth system implemented  
✅ **Environment Variables**: Template files created  
✅ **Vercel Configurations**: Deployment configs ready  

---

## Phase 1: Repository Setup & Backup

### Step 1.1: Create Backup Repository (CRITICAL FIRST STEP)

**You need to do this:** Create a backup of your current production scheduler app.

1. **Go to GitHub** and create a new repository named `school-scheduler-standalone-backup`
2. **Clone your current production repository** (the one currently deployed to scheduler.schooltools.online)
3. **Push to the backup repository**:
   ```bash
   # Clone your current production repo
   git clone https://github.com/YOUR_USERNAME/current-scheduler-repo.git scheduler-backup
   cd scheduler-backup
   
   # Add new remote for backup
   git remote set-url origin https://github.com/YOUR_USERNAME/school-scheduler-standalone-backup.git
   
   # Push to backup repository
   git push -u origin main
   ```

### Step 1.2: Create New Production Repository

**You need to do this:** Create the main repository for the new multi-module app.

1. **Go to GitHub** and create a new repository named `school-scheduler-multi-module`
2. **Push your current codebase** (this improved version) to the new repository:
   ```bash
   # In your current project directory
   git remote add production https://github.com/YOUR_USERNAME/school-scheduler-multi-module.git
   git push -u production main
   ```

---

## Phase 2: Environment Configuration

### Step 2.1: Prepare Environment Variables

**I've created template files** in `apps/central-hub/.env.example` and `apps/scheduler-module/.env.example`

**You need to gather these values:**
- `VITE_SUPABASE_URL`: From your Supabase dashboard
- `VITE_SUPABASE_ANON_KEY`: From your Supabase dashboard → Settings → API

---

## Phase 3: Vercel Deployment Setup

### Step 3.1: Deploy Central Hub (New)

**You need to do this in Vercel dashboard:**

1. **Go to Vercel Dashboard** → "Add New..." → "Project"
2. **Import** your new GitHub repository (`school-scheduler-multi-module`)
3. **Configure the project:**
   - **Project Name**: `school-scheduler-central-hub`
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/central-hub`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Environment Variables** (add these in Vercel project settings):
   ```
   VITE_SUPABASE_URL=https://xetfugvbiewwhpsxohne.supabase.co
   VITE_SUPABASE_ANON_KEY=[your_anon_key_here]
   VITE_CENTRAL_HUB_URL=https://app.schooltools.online
   VITE_CURRENT_SUBDOMAIN=app
   VITE_SCHEDULER_URL=https://scheduler.schooltools.online
   NODE_ENV=production
   ```

5. **Deploy** and test the initial deployment

### Step 3.2: Configure Central Hub Domain

**You need to do this in Vercel:**

1. **In the central-hub project** → Settings → Domains
2. **Add domain**: `app.schooltools.online`
3. **Follow Vercel's DNS instructions** (you'll configure this in Namecheap)

### Step 3.3: Deploy Scheduler Module (Replacement)

**You need to do this in Vercel dashboard:**

1. **Create a new Vercel project** (don't modify the existing one yet)
2. **Import** the same GitHub repository (`school-scheduler-multi-module`)
3. **Configure the project:**
   - **Project Name**: `school-scheduler-module`
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/scheduler-module`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Environment Variables**:
   ```
   VITE_SUPABASE_URL=https://xetfugvbiewwhpsxohne.supabase.co
   VITE_SUPABASE_ANON_KEY=[your_anon_key_here]
   VITE_CENTRAL_HUB_URL=https://app.schooltools.online
   VITE_CURRENT_SUBDOMAIN=scheduler
   VITE_MODULE_NAME=scheduler
   VITE_MODULE_DISPLAY_NAME=Lesson Scheduler
   NODE_ENV=production
   ```

5. **Deploy** and test

### Step 3.4: Switch Scheduler Domain (CRITICAL STEP)

**You need to coordinate this carefully:**

1. **First, test the new scheduler deployment** on its temporary Vercel URL
2. **When ready to switch:**
   - **Remove** `scheduler.schooltools.online` from your old Vercel project
   - **Add** `scheduler.schooltools.online` to your new scheduler-module project
3. **The domain will automatically switch** to the new deployment

---

## Phase 4: DNS Configuration

### Step 4.1: Configure DNS in Namecheap

**You need to do this in your domain registrar:**

1. **Log in to Namecheap** (or your DNS provider)
2. **Go to Domain List** → select `schooltools.online`
3. **Click Manage** → **Advanced DNS**
4. **Add/Update these CNAME records:**

   ```
   Type: CNAME | Host: app | Value: cname.vercel-dns.com | TTL: Automatic
   Type: CNAME | Host: scheduler | Value: cname.vercel-dns.com | TTL: Automatic
   ```

5. **Save changes** and wait for DNS propagation (5-48 hours, usually much faster)

---

## Phase 5: Testing & Verification

### Step 5.1: Functionality Testing

**Test these flows in order:**

1. **Central Hub Access:**
   - Visit `https://app.schooltools.online`
   - Test login functionality
   - Test school selection
   - Test module navigation

2. **Scheduler Module Access:**
   - Visit `https://scheduler.schooltools.online` directly
   - Should redirect to central hub for auth if not logged in
   - Test direct URL access to school: `https://scheduler.schooltools.online/school/[school-slug]`

3. **Cross-Domain Authentication:**
   - Login at `app.schooltools.online`
   - Navigate to scheduler via module selector
   - Verify session is maintained
   - Test back-navigation to central hub

### Step 5.2: Performance Testing

**Check these metrics:**
- Page load times on both subdomains
- Authentication flow speed
- Module navigation responsiveness

---

## Phase 6: Monitoring & Rollback Plan

### Step 6.1: Monitoring Setup

**You should monitor:**
- Vercel deployment status for both projects
- Error rates in both applications
- User authentication success rates
- Cross-domain navigation success

### Step 6.2: Rollback Plan

**If issues occur:**

1. **Immediate rollback**: Re-add `scheduler.schooltools.online` to your backup/original Vercel project
2. **DNS rollback**: Remove the new CNAME records if needed
3. **User communication**: Notify users of temporary maintenance

---

## Production Deployment Checklist

### Pre-Deployment (You handle)
- [ ] Create backup GitHub repository
- [ ] Create new production GitHub repository
- [ ] Gather Supabase credentials
- [ ] Test local development servers

### Vercel Setup (You handle)
- [ ] Deploy central-hub project
- [ ] Configure central-hub environment variables
- [ ] Deploy scheduler-module project
- [ ] Configure scheduler-module environment variables
- [ ] Test both deployments on temporary URLs

### Domain Configuration (You handle)
- [ ] Add app.schooltools.online to central-hub project
- [ ] Configure DNS CNAME for app subdomain
- [ ] Test central-hub on app.schooltools.online
- [ ] Switch scheduler.schooltools.online to new project
- [ ] Test complete flow

### Final Testing (You handle)
- [ ] Test direct access to both subdomains
- [ ] Test cross-domain authentication
- [ ] Test module navigation
- [ ] Test all core functionality
- [ ] Monitor for 24 hours

---

## Important Notes

🚨 **CRITICAL**: Always create the backup repository first  
⚠️ **DNS**: Changes can take up to 48 hours to propagate globally  
🔄 **Rollback**: Keep your old Vercel project until new deployment is confirmed stable  
📊 **Monitoring**: Watch error rates and user feedback closely for first 48 hours  

---

## Support & Troubleshooting

### Common Issues:

1. **CORS Errors**: Verify Supabase CORS settings include both subdomains
2. **Authentication Issues**: Check environment variables match exactly
3. **DNS Issues**: Use DNS checker tools to verify propagation
4. **Build Failures**: Check that all dependencies are properly installed

### Emergency Contacts:
- Vercel Support: For deployment issues
- Namecheap Support: For DNS issues
- This conversation: For configuration questions

---

**Ready to start? Let me know when you want to begin, and I'll guide you through each step!** 