# Phase 7: Multi-Subdomain Deployment & Production Setup

## Overview
Deploy the multi-tenant school management system across multiple subdomains with proper inter-app communication and authentication flow.

## Target Architecture

### Subdomain Structure
- **`app.schooltools.online`** - Central Hub (Dashboard, School Management, Module Selection)
- **`scheduler.schooltools.online`** - Scheduler Module
- **`lunch-menu.schooltools.online`** - Lunch Menu Module (future)
- **Future modules...** - Additional learning modules

### Authentication Flow
1. User logs in at any subdomain → redirected to `app.schooltools.online` for authentication
2. After login → redirected back to intended destination with auth tokens
3. Session shared across all subdomains via secure cross-domain auth

## Step-by-Step Implementation Plan

### Step 1: Separate the Scheduler Module

#### 1.1 Create Standalone Scheduler App
```bash
# Create new directory structure
mkdir apps/scheduler-module
cd apps/scheduler-module

# Copy scheduler-specific files from main app
cp -r ../../src/components/scheduler ./src/components/
cp -r ../../src/components/subjects ./src/components/
cp -r ../../src/components/teachers ./src/components/
cp -r ../../src/components/locations ./src/components/
cp -r ../../src/pages/Schedule.tsx ./src/pages/
cp -r ../../src/pages/Subjects.tsx ./src/pages/
cp -r ../../src/pages/Teachers.tsx ./src/pages/
cp -r ../../src/pages/Locations.tsx ./src/pages/
```

#### 1.2 Create Scheduler Module Package Structure
```
apps/scheduler-module/
├── src/
│   ├── components/
│   │   ├── scheduler/
│   │   ├── subjects/
│   │   ├── teachers/
│   │   ├── locations/
│   │   └── layout/
│   ├── pages/
│   ├── contexts/
│   ├── hooks/
│   └── lib/
├── package.json
├── vite.config.ts
├── vercel.json
└── index.html
```

#### 1.3 Configure Scheduler Module Dependencies
```json
// apps/scheduler-module/package.json
{
  "name": "@schooltools/scheduler-module",
  "dependencies": {
    "@schooltools/shared-auth": "workspace:*",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "@supabase/supabase-js": "^2.39.3",
    // ... other scheduler-specific dependencies
  }
}
```

### Step 2: Update Shared Authentication Package

#### 2.1 Enhance Cross-Domain Authentication
```typescript
// packages/shared-auth/src/auth/AuthProvider.tsx

// Add cross-domain auth support
const CENTRAL_HUB_URL = 'https://app.schooltools.online';
const AUTH_REDIRECT_KEY = 'auth_redirect_after_login';

export const AuthProvider = ({ children, supabaseClient, currentSubdomain }) => {
  const handleCrossDomainAuth = async () => {
    // If not authenticated and not on central hub, redirect to central hub
    if (!isAuthenticated && currentSubdomain !== 'app') {
      const currentUrl = window.location.href;
      localStorage.setItem(AUTH_REDIRECT_KEY, currentUrl);
      window.location.href = `${CENTRAL_HUB_URL}/login`;
      return;
    }
  };

  const handleAuthRedirect = async () => {
    // After successful login on central hub, redirect back to original destination
    const redirectUrl = localStorage.getItem(AUTH_REDIRECT_KEY);
    if (redirectUrl && isAuthenticated) {
      localStorage.removeItem(AUTH_REDIRECT_KEY);
      window.location.href = redirectUrl;
    }
  };
  
  // ... rest of implementation
};
```

#### 2.2 Add Module Navigation Helper
```typescript
// packages/shared-auth/src/navigation/moduleNavigation.ts

export const navigateToModule = (
  moduleName: string, 
  schoolSlug: string, 
  path: string = ''
) => {
  const moduleSubdomains = {
    scheduler: 'scheduler.schooltools.online',
    'lunch-menu': 'lunch-menu.schooltools.online'
  };
  
  const subdomain = moduleSubdomains[moduleName];
  if (!subdomain) {
    console.error(`Unknown module: ${moduleName}`);
    return;
  }
  
  const targetUrl = `https://${subdomain}/school/${schoolSlug}${path}`;
  window.location.href = targetUrl;
};

export const navigateToCentralHub = (path: string = '') => {
  window.location.href = `https://app.schooltools.online${path}`;
};
```

### Step 3: Configure Vercel Deployments

#### 3.1 Central Hub Deployment Configuration
```json
// apps/central-hub/vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "functions": {
    "app/api/auth/callback": {
      "runtime": "nodejs18.x"
    }
  }
}
```

#### 3.2 Scheduler Module Deployment Configuration
```json
// apps/scheduler-module/vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/school/([^/]+)/(.*)",
      "dest": "/index.html"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Step 4: Production Deployment Process

#### 4.1 Setup Vercel Projects

**Central Hub Project:**
```bash
# In apps/central-hub directory
vercel --prod
# Configure domain: app.schooltools.online
```

**Scheduler Module Project:**
```bash
# In apps/scheduler-module directory  
vercel --prod
# Configure domain: scheduler.schooltools.online
```

#### 4.2 Environment Variables for Each Deployment

**Both projects need:**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CENTRAL_HUB_URL=https://app.schooltools.online
VITE_CURRENT_SUBDOMAIN=app|scheduler
```

**Scheduler module additional:**
```env
VITE_MODULE_NAME=scheduler
VITE_MODULE_DISPLAY_NAME=Lesson Scheduler
```

#### 4.3 DNS Configuration

**In Namecheap (or your DNS provider):**
```
Type: CNAME | Host: app | Value: cname.vercel-dns.com
Type: CNAME | Host: scheduler | Value: cname.vercel-dns.com  
Type: CNAME | Host: lunch-menu | Value: cname.vercel-dns.com
```

### Step 5: Inter-App Communication Setup

#### 5.1 Shared State Management
```typescript
// packages/shared-auth/src/storage/crossDomainStorage.ts

export class CrossDomainStorage {
  private static readonly STORAGE_KEY = 'schooltools_shared_state';
  
  static setSharedData(data: any) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    // Also set in sessionStorage for cross-tab communication
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }
  
  static getSharedData() {
    const data = localStorage.getItem(this.STORAGE_KEY) || 
                 sessionStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }
  
  static clearSharedData() {
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
}
```

#### 5.2 School Context Sharing
```typescript
// packages/shared-auth/src/school/schoolSync.ts

export const syncSchoolAcrossApps = (school: School) => {
  CrossDomainStorage.setSharedData({
    currentSchool: school,
    timestamp: Date.now()
  });
};

export const getCurrentSchoolFromSync = (): School | null => {
  const data = CrossDomainStorage.getSharedData();
  if (!data || Date.now() - data.timestamp > 30 * 60 * 1000) { // 30 min expiry
    return null;
  }
  return data.currentSchool;
};
```

### Step 6: Update Central Hub Module Selector

#### 6.1 Enhanced Module Navigation
```typescript
// apps/central-hub/src/components/modules/ModuleSelector.tsx

const handleModuleSelect = (module: any) => {
  // Store current school context
  syncSchoolAcrossApps(selectedSchool);
  
  // Navigate to module subdomain
  navigateToModule(module.module_name, selectedSchool.slug);
};
```

### Step 7: Update Scheduler Module for Standalone Operation

#### 7.1 Standalone App Component
```typescript
// apps/scheduler-module/src/App.tsx

import { SchoolProvider, AuthProvider } from '@schooltools/shared-auth';
import { getCurrentSchoolFromSync } from '@schooltools/shared-auth/school/schoolSync';

function App() {
  const [initialSchool, setInitialSchool] = useState(null);
  
  useEffect(() => {
    // Try to get school from URL params or cross-domain storage
    const urlSchool = getSchoolFromUrl();
    const syncedSchool = getCurrentSchoolFromSync();
    
    setInitialSchool(urlSchool || syncedSchool);
  }, []);
  
  if (!initialSchool) {
    return <SchoolRedirectHandler />;
  }
  
  return (
    <AuthProvider supabaseClient={supabase} currentSubdomain="scheduler">
      <SchoolProvider supabaseClient={supabase} initialSchool={initialSchool}>
        <BrowserRouter>
          <Routes>
            <Route path="/school/:schoolSlug" element={<SchedulerModule />} />
            <Route path="*" element={<Navigate to={`/school/${initialSchool.slug}`} />} />
          </Routes>
        </BrowserRouter>
      </SchoolProvider>
    </AuthProvider>
  );
}
```

### Step 8: Testing & Verification

#### 8.1 Cross-Domain Authentication Test
1. Visit `scheduler.schooltools.online` while logged out
2. Should redirect to `app.schooltools.online/login`  
3. After login, should return to scheduler with school context

#### 8.2 Module Navigation Test
1. Login at `app.schooltools.online`
2. Select school and click "Scheduler" module
3. Should navigate to `scheduler.schooltools.online/school/{slug}`
4. Should maintain authentication and school context

#### 8.3 Direct URL Access Test
1. Visit `scheduler.schooltools.online/school/test-school` directly
2. Should authenticate or redirect to login
3. Should load with correct school context

### Step 9: Performance & Security Optimization

#### 9.1 CDN & Caching
- Enable Vercel CDN for static assets
- Configure appropriate cache headers
- Optimize bundle sizes per module

#### 9.2 Security Headers
```json
// vercel.json for each app
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options", 
          "value": "nosniff"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

### Step 10: Monitoring & Analytics

#### 10.1 Error Tracking
- Setup Sentry for each subdomain
- Configure error boundaries
- Monitor cross-domain auth failures

#### 10.2 Performance Monitoring
- Setup Vercel Analytics
- Monitor page load times across subdomains
- Track user flows between apps

## Success Criteria

✅ **Authentication Flow**: Users can seamlessly authenticate across all subdomains  
✅ **Module Navigation**: Central hub properly routes to specific module subdomains  
✅ **School Context**: School selection persists across subdomain navigation  
✅ **Direct Access**: Module URLs work when accessed directly  
✅ **Performance**: Each module loads independently with optimized bundles  
✅ **Security**: Proper CORS, authentication, and security headers  
✅ **Monitoring**: Full visibility into system performance and errors

## Future Phases

### Phase 8: Additional Modules
- Lunch Menu Module deployment
- Other learning modules
- Module marketplace/plugin system

### Phase 9: Advanced Features  
- Real-time collaboration
- Advanced analytics dashboard
- Mobile app integration
- API for third-party integrations 