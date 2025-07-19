# 🚀 START HERE: Production Deployment

## Ready to Deploy? Follow These Steps!

I've prepared everything for your multi-subdomain deployment. Here's exactly what you need to do:

## ⚡ Step 1: BACKUP FIRST (CRITICAL)

**Before anything else, create a backup of your current production app:**

1. **Go to GitHub** and create a new repository: `school-scheduler-standalone-backup`
2. **Clone your current production repository** (the one powering scheduler.schooltools.online)
3. **Push to backup repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/CURRENT_REPO.git scheduler-backup
   cd scheduler-backup
   git remote set-url origin https://github.com/YOUR_USERNAME/school-scheduler-standalone-backup.git
   git push -u origin main
   ```

## ⚡ Step 2: Create New Production Repository

1. **Go to GitHub** and create: `school-scheduler-multi-module`
2. **In this project directory**, run:
   ```bash
   git remote add production https://github.com/YOUR_USERNAME/school-scheduler-multi-module.git
   git push -u production main
   ```

## ⚡ Step 3: Get Your Supabase Credentials

You'll need these values for Vercel:
- **VITE_SUPABASE_URL**: `https://xetfugvbiewwhpsxohne.supabase.co` ✅ (I found this)
- **VITE_SUPABASE_ANON_KEY**: Get from Supabase Dashboard → Settings → API

## ⚡ Step 4: Deploy to Vercel

### Central Hub (New App)
1. **Vercel Dashboard** → "Add New Project"
2. **Import** your `school-scheduler-multi-module` repository
3. **Configure**:
   - Project Name: `school-scheduler-central-hub`
   - Framework: Vite
   - Root Directory: `apps/central-hub`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Add Environment Variables** (in Vercel project settings):
   ```
   VITE_SUPABASE_URL=https://xetfugvbiewwhpsxohne.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
   VITE_CENTRAL_HUB_URL=https://app.schooltools.online
   VITE_CURRENT_SUBDOMAIN=app
   VITE_SCHEDULER_URL=https://scheduler.schooltools.online
   NODE_ENV=production
   ```

5. **Deploy** and note the temporary URL

### Scheduler Module (Replacement App)
1. **Create another Vercel project** from the same repository
2. **Configure**:
   - Project Name: `school-scheduler-module`
   - Framework: Vite
   - Root Directory: `apps/scheduler-module`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Add Environment Variables**:
   ```
   VITE_SUPABASE_URL=https://xetfugvbiewwhpsxohne.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
   VITE_CENTRAL_HUB_URL=https://app.schooltools.online
   VITE_CURRENT_SUBDOMAIN=scheduler
   VITE_MODULE_NAME=scheduler
   VITE_MODULE_DISPLAY_NAME=Lesson Scheduler
   NODE_ENV=production
   ```

4. **Deploy** and test on temporary URL

## ⚡ Step 5: Configure Domains

### Add New Domain (Central Hub)
1. **In central-hub project** → Settings → Domains
2. **Add**: `app.schooltools.online`

### Switch Existing Domain (Scheduler)
1. **Test new scheduler** on its temporary URL first
2. **When ready**: Remove `scheduler.schooltools.online` from old project
3. **Add** `scheduler.schooltools.online` to new scheduler-module project

## ⚡ Step 6: DNS Setup

**In Namecheap** (or your DNS provider):
1. **Domain List** → `schooltools.online` → Manage → Advanced DNS
2. **Add CNAME records**:
   ```
   Type: CNAME | Host: app | Value: cname.vercel-dns.com
   Type: CNAME | Host: scheduler | Value: cname.vercel-dns.com
   ```

## 🧪 Step 7: Test Everything

1. **Visit** `https://app.schooltools.online` (login, select school, navigate to scheduler)
2. **Visit** `https://scheduler.schooltools.online` directly
3. **Test** cross-domain authentication flow

---

## 📚 Full Documentation

- **Complete Plan**: `PRODUCTION_DEPLOYMENT_PLAN.md`
- **Commands Reference**: `DEPLOYMENT_COMMANDS.md`
- **Configurations**: Check `apps/*/vercel.json` files

## 🆘 Need Help?

**I'm here to help!** Just ask me:
- "Walk me through step X"
- "I'm getting error Y, what should I do?"
- "How do I verify Z is working?"

## 🔄 Rollback Plan

**If anything goes wrong:**
1. **Quick fix**: Re-add `scheduler.schooltools.online` to your old Vercel project
2. **Full rollback**: Remove new DNS records

---

**Ready to start? Let's begin with Step 1 - creating your backup repository!** 