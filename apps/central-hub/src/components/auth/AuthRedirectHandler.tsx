import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@schooltools/shared-auth'
import { supabase } from '@/lib/supabaseClient'

const AuthRedirectHandler: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [processing, setProcessing] = useState(true)

  useEffect(() => {
    const handleRedirect = async () => {
      // Handle incoming auth redirects from other subdomains
      const schoolId = searchParams.get('school')
      const moduleId = searchParams.get('module')
      
      if (isAuthenticated) {
        // If user is authenticated and we have school/module info, redirect appropriately
        if (schoolId && moduleId) {
          try {
            // Resolve school ID to slug
            const { data, error } = await supabase
              .from('schools')
              .select('slug')
              .eq('id', schoolId)
              .eq('active', true)
              .single()

            if (error || !data) {
              console.error('Error resolving school ID to slug:', error)
              // Fall back to dashboard if school resolution fails
              navigate('/', { replace: true })
              return
            }

            // Redirect to specific module with slug
            const moduleSubdomain = getModuleSubdomain(moduleId)
            if (moduleSubdomain) {
              window.location.href = `https://${moduleSubdomain}.schooltools.online/school/${data.slug}`
              return
            }
          } catch (err) {
            console.error('Exception resolving school:', err)
          }
        }
        
        // Default to dashboard
        navigate('/', { replace: true })
      } else {
        // Not authenticated, redirect to login
        navigate('/login', { replace: true })
      }
      
      setProcessing(false)
    }

    handleRedirect()
  }, [isAuthenticated, searchParams, navigate])

  const getModuleSubdomain = (moduleId: string): string | null => {
    const moduleMap: Record<string, string> = {
      'scheduler': 'scheduler',
      'menus': 'menus',
      // Add more modules as they're created
    }
    return moduleMap[moduleId] || null
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">
          {processing ? 'Redirecting...' : 'Loading...'}
        </p>
      </div>
    </div>
  )
}

export default AuthRedirectHandler 