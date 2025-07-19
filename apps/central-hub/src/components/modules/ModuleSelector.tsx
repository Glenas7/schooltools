import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SchoolWithRole, navigateToModule, syncSchoolAcrossApps } from '@schooltools/shared-auth'
import { supabase } from '@/lib/supabaseClient'

interface ModuleSelectorProps {
  schoolId?: string
  schoolSlug?: string
  selectedSchool?: SchoolWithRole | null
}

const ModuleSelector: React.FC<ModuleSelectorProps> = ({ schoolId, schoolSlug, selectedSchool }) => {

  // Get selected school from localStorage if not provided
  const currentSchoolId = schoolId || selectedSchool?.id || localStorage.getItem('last_selected_school')
  const currentSchoolSlug = schoolSlug || selectedSchool?.slug // For URL construction, prefer slug over ID

  // Get available modules from the selected school's data
  const availableModules = selectedSchool?.modules || []

  // Track if this is an explicit return from a module (persistent during component lifecycle)
  const isExplicitReturnRef = useRef<boolean | null>(null)

  // Check for explicit return parameter once on mount
  useEffect(() => {
    if (isExplicitReturnRef.current === null) {
      const urlParams = new URLSearchParams(window.location.search)
      const isExplicitReturn = urlParams.get('return') === 'true'
      isExplicitReturnRef.current = isExplicitReturn
      
      // Clean up the return parameter from URL if present
      if (isExplicitReturn) {
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, document.title, cleanUrl)
        console.log('Detected explicit return from module - skipping auto-redirect')
      }
    }
  }, [])

  // Auto-redirect logic (only runs when modules are available and not an explicit return)
  useEffect(() => {
    const performAutoRedirect = async () => {
      // Only auto-redirect if this is NOT an explicit return
      if (isExplicitReturnRef.current !== true) {
        const lastModule = localStorage.getItem('last_accessed_module')
        if (lastModule && (currentSchoolSlug || currentSchoolId)) {
          const module = availableModules.find(m => m.module_name === lastModule)
          if (module) {
            console.log('Auto-redirecting to last accessed module:', lastModule)
            await handleModuleSelect(module)
          }
        }
      } else {
        console.log('Skipping auto-redirect due to explicit return')
      }
    }

    performAutoRedirect()
  }, [currentSchoolSlug, currentSchoolId, availableModules])

  const handleModuleSelect = async (module: any) => {
    // Ensure we have either a slug or an ID
    if (!currentSchoolSlug && !currentSchoolId) return

    // Store module preference
    localStorage.setItem('last_accessed_module', module.module_name)
    
    // Sync school context across apps
    if (selectedSchool) {
      syncSchoolAcrossApps(selectedSchool)
    }
    
    // Navigate to the module using the new navigation utility with session transfer
    const schoolIdentifier = currentSchoolSlug || currentSchoolId
    if (!schoolIdentifier) {
      console.error('No school identifier available for navigation')
      return
    }
    await navigateToModule(module.module_name, schoolIdentifier, '', supabase)
  }

  if (!currentSchoolSlug && !currentSchoolId) {
    return (
      <Card className="max-w-md">
        <CardContent className="pt-6">
          <p className="text-gray-600 text-center">
            Please select a school first to access modules.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (availableModules.length === 0) {
    return (
      <Card className="max-w-md">
        <CardContent className="pt-6">
          <p className="text-gray-600 text-center">
            No modules are available for this school.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {availableModules.map((module) => (
        <Card 
          key={module.module_id}
          className="transition-all hover:shadow-lg cursor-pointer hover:border-blue-300"
          onClick={async () => await handleModuleSelect(module)}
        >
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">
              {module.module_icon || '📋'}
            </div>
            <CardTitle className="text-xl">{module.module_display_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Access level: {module.user_role}
            </p>
            
            <div className="text-center">
              <Button 
                className="w-full" 
                onClick={async (e) => {
                  e.stopPropagation()
                  await handleModuleSelect(module)
                }}
              >
                Open Module
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default ModuleSelector 