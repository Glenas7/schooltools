import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { Toaster } from 'sonner'

// Import core contexts
import { AuthProvider, useAuth, SchoolProvider, SchoolsProvider } from './core/contexts'

// Import shared pages
import Login from './shared/pages/Login'
import SchedulerLogin from './shared/pages/SchedulerLogin'
import Signup from './shared/pages/Signup'
import ForgotPassword from './shared/pages/ForgotPassword'
import ResetPassword from './shared/pages/ResetPassword'
import NotFound from './shared/pages/NotFound'
import Index from './shared/pages/Index'


// Import Central Hub pages
import Dashboard from './modules/central-hub/pages/Dashboard'
import SchoolManagement from './modules/central-hub/pages/SchoolManagement'

// Import Scheduler pages
import Schedule from './modules/scheduler/pages/Schedule'
import Teachers from './modules/scheduler/pages/Teachers'
import Subjects from './modules/scheduler/pages/Subjects'
import Locations from './modules/scheduler/pages/Locations'
import Settings from './modules/scheduler/pages/Settings'

// Import Scheduler layout
import SchoolLayout from './modules/scheduler/components/layout/SchoolLayout'

// Import shared auth components
import RequireAuth from './shared/components/auth/RequireAuth'
import RequireSchoolAccess from './shared/components/auth/RequireSchoolAccess'
import AuthRedirectHandler from './shared/components/auth/AuthRedirectHandler'

// Import scheduler contexts
import { SubjectsProvider } from './modules/scheduler/contexts/SubjectsContext'
import { TeachersProvider } from './modules/scheduler/contexts/TeachersContext'
import { LocationsProvider } from './modules/scheduler/contexts/LocationsContext'
import LessonsProvider from './modules/scheduler/contexts/LessonsContext'
import { DragProvider } from './modules/scheduler/contexts/DragContext'

const queryClient = new QueryClient()

// Layout wrapper for school-specific scheduler routes
const SchedulerSchoolLayout: React.FC = () => {
  return (
    <RequireAuth>
      <RequireSchoolAccess>
        <SubjectsProvider>
          <TeachersProvider>
            <LocationsProvider>
              <LessonsProvider>
                <DragProvider>
                  <SchoolLayout />
                </DragProvider>
              </LessonsProvider>
            </LocationsProvider>
          </TeachersProvider>
        </SubjectsProvider>
      </RequireSchoolAccess>
    </RequireAuth>
  )
}

// Main authenticated app component
const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, loading } = useAuth()

  console.log('[AuthenticatedApp] Render - loading:', loading, 'isAuthenticated:', isAuthenticated);

  if (loading) {
    console.log('[AuthenticatedApp] Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  console.log('[AuthenticatedApp] Proceeding with main app render');

  return (
    <SchoolsProvider>
      <BrowserRouter>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
                          <Route path="/scheduler/login" element={<SchedulerLogin />} />
          <Route path="/signup" element={!isAuthenticated ? <Signup /> : <Navigate to="/" replace />} />
          <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" replace />} />
          <Route path="/reset-password" element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/" replace />} />
          <Route path="/auth-redirect" element={<AuthRedirectHandler />} />

          <Route path="/index" element={isAuthenticated ? <Index /> : <Navigate to="/login" replace />} />
          
          {/* Protected central hub routes */}
          <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/school/:schoolSlug/manage" element={isAuthenticated ? <SchoolManagement /> : <Navigate to="/login" replace />} />
          
          {/* Protected school-specific scheduler routes */}
          <Route path="/school/:schoolSlug" element={
            isAuthenticated ? (
              <SchoolProvider>
                <SchedulerSchoolLayout />
              </SchoolProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }>
            <Route index element={<Navigate to="schedule" replace />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="locations" element={<Locations />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          {/* 404 and fallback routes */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </SchoolsProvider>
  )
}

// Main App component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App