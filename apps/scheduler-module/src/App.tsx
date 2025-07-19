import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, SchoolProvider, SchoolsProvider, getCurrentSchoolFromSync, navigateToCentralHub, getCurrentSubdomain, useAuth } from '@schooltools/shared-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { supabase } from './lib/supabaseClient'
import { Toaster } from 'sonner'
import { Loader2 } from 'lucide-react'

// Import scheduler components and contexts
import { SubjectsProvider } from './contexts/SubjectsContext'
import { TeachersProvider } from './contexts/TeachersContext'
import { LocationsProvider } from './contexts/LocationsContext'
import LessonsProvider from './contexts/LessonsContext'
import { DragProvider } from './contexts/DragContext'

// Import pages and layouts
import SchoolLayout from './components/layout/SchoolLayout'
import RequireAuth from './components/auth/RequireAuth'
import RequireSchoolAccess from './components/auth/RequireSchoolAccess'
import Schedule from './pages/Schedule'
import Teachers from './pages/Teachers'
import Subjects from './pages/Subjects'
import Locations from './pages/Locations'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import SchoolSelect from './pages/SchoolSelect'
import Index from './pages/Index'

const queryClient = new QueryClient()

// School redirect handler for when no school context is available
const SchoolRedirectHandler: React.FC = () => {
  useEffect(() => {
    console.log('No school context available, redirecting to central hub')
    navigateToCentralHub()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">Redirecting to school selection...</p>
      </div>
    </div>
  )
}

// Module wrapper with all necessary contexts
const SchedulerModuleWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SubjectsProvider>
      <LocationsProvider>
        <TeachersProvider>
          <LessonsProvider>
            <DragProvider>
              {children}
            </DragProvider>
          </LessonsProvider>
        </TeachersProvider>
      </LocationsProvider>
    </SubjectsProvider>
  )
}

// School layout wrapper that includes all the scheduler contexts
const SchedulerSchoolLayout: React.FC = () => {
  return (
    <RequireAuth>
      <RequireSchoolAccess>
        <SchedulerModuleWrapper>
          <SchoolLayout />
        </SchedulerModuleWrapper>
      </RequireSchoolAccess>
    </RequireAuth>
  )
}

// Component that waits for auth to be ready
const AuthenticatedApp: React.FC = () => {
  const { isAuthenticated, loading: authLoading, user } = useAuth()
  const [initialSchool, setInitialSchool] = useState<{slug?: string, id?: string, name?: string} | null>(null)
  const [loading, setLoading] = useState(true)

  const getSchoolFromUrl = () => {
    const pathParts = window.location.pathname.split('/')
    const schoolIndex = pathParts.indexOf('school')
    
    if (schoolIndex !== -1 && pathParts[schoolIndex + 1]) {
      return pathParts[schoolIndex + 1] // This is the school slug
    }
    
    return null
  }

  useEffect(() => {
    const loadInitialSchool = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        console.log('Auth still loading, waiting...')
        return
      }

      console.log('Auth loading complete. isAuthenticated:', isAuthenticated, 'user:', user?.id)
      
      if (!isAuthenticated || !user) {
        console.log('User not authenticated, redirecting to central hub')
        navigateToCentralHub()
        return
      }

      console.log('Loading initial school for authenticated user...')
      
      // Try to get school from URL params first
      const urlSchoolSlug = getSchoolFromUrl()
      
      if (urlSchoolSlug) {
        console.log('Found school slug in URL:', urlSchoolSlug)
        setInitialSchool({ slug: urlSchoolSlug })
        setLoading(false)
        return
      }
      
      // Try to get school from cross-domain sync
      const syncedSchool = getCurrentSchoolFromSync()
      if (syncedSchool) {
        console.log('Found synced school:', syncedSchool.name)
        setInitialSchool(syncedSchool)
        setLoading(false)
        return
      }
      
      console.log('No school context found')
      setInitialSchool(null)
      setLoading(false)
    }

    loadInitialSchool()
  }, [authLoading, isAuthenticated, user])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">
            {authLoading ? 'Authenticating...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <SchoolRedirectHandler />
  }

  if (!initialSchool) {
    return <SchoolRedirectHandler />
  }

  const currentSubdomain = getCurrentSubdomain()
  console.log('Scheduler module starting with subdomain:', currentSubdomain)

  return (
    <SchoolsProvider supabaseClient={supabase}>
      <BrowserRouter>
        <Routes>
          {/* Authentication routes that don't need school context */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/school-select" element={<SchoolSelect />} />
          <Route path="/" element={<Index />} />
          
          {/* School-specific routes wrapped with SchoolProvider */}
          <Route path="/school/:schoolSlug" element={
            <SchoolProvider supabaseClient={supabase}>
              <SchedulerSchoolLayout />
            </SchoolProvider>
          }>
            <Route index element={<Navigate to="schedule" replace />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="locations" element={<Locations />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          {/* Fallback route */}
          <Route path="*" element={
            initialSchool?.slug || initialSchool?.id ? (
              <Navigate to={`/school/${initialSchool.slug || initialSchool.id}/schedule`} replace />
            ) : (
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading school context...</p>
                </div>
              </div>
            )
          } />
        </Routes>
      </BrowserRouter>
    </SchoolsProvider>
  )
}

// Main App component that handles session restoration
function App() {
  const [sessionRestored, setSessionRestored] = useState(false)

  // Restore session from URL parameters if coming from central hub
  useEffect(() => {
    const restoreSessionFromUrl = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const accessToken = urlParams.get('access_token')
      const refreshToken = urlParams.get('refresh_token')
      const fromHub = urlParams.get('from_hub')

      if (fromHub === 'true' && accessToken && refreshToken) {
        try {
          console.log('Restoring session from central hub...')
          
          // Set up a listener for auth state changes to know when session is properly restored
          const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              console.log('Auth state change detected - user signed in, session restored')
              // Clean up URL parameters
              const cleanUrl = window.location.pathname
              window.history.replaceState({}, document.title, cleanUrl)
              setSessionRestored(true)
              authListener.subscription.unsubscribe() // Clean up listener
            }
          })
          
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (error) {
            console.error('Error restoring session:', error)
            authListener.subscription.unsubscribe()
            setSessionRestored(true)
          } else {
            console.log('Session restored successfully from central hub, waiting for auth state change...')
            // Don't set sessionRestored here - wait for the auth state change event
          }
        } catch (error) {
          console.error('Exception restoring session:', error)
          setSessionRestored(true)
        }
      } else {
        setSessionRestored(true)
      }
    }

    restoreSessionFromUrl()
  }, [])

  if (!sessionRestored) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Restoring session...</p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider supabaseClient={supabase}>
          <AuthenticatedApp />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App 