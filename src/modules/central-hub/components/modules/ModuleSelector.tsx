import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { SchoolWithRole, syncSchoolAcrossApps, useAuth } from '@/core/contexts'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/core/lib/supabaseClient'

interface ModuleSelectorProps {
  schoolId?: string
  schoolSlug?: string
  selectedSchool?: SchoolWithRole | null
}

const ModuleSelector: React.FC<ModuleSelectorProps> = ({ schoolId, schoolSlug, selectedSchool }) => {
  const navigate = useNavigate()
  const { updateLastAccessedSchool } = useAuth()

  // Get selected school from localStorage if not provided
  const currentSchoolId = schoolId || selectedSchool?.id || localStorage.getItem('last_selected_school')
  const currentSchoolSlug = schoolSlug || selectedSchool?.slug // For URL construction, prefer slug over ID

  // Get available modules from the selected school's data
  const availableModules = selectedSchool?.modules || []

  const handleModuleSelect = async (module: any) => {
    // Ensure we have either a slug or an ID
    if (!currentSchoolSlug && !currentSchoolId) return
    
    // Sync school context across apps
    if (selectedSchool) {
      syncSchoolAcrossApps(selectedSchool)
    }
    
    // Update the user's last accessed school in the database
    if (currentSchoolId && updateLastAccessedSchool) {
      updateLastAccessedSchool(currentSchoolId);
    }
    
    // Navigate to the module using the new navigation utility with session transfer
    const schoolIdentifier = currentSchoolSlug || currentSchoolId
    if (!schoolIdentifier) {
      console.error('No school identifier available for navigation')
      return
    }
    navigate(`/school/${schoolIdentifier}/${module.module_name === 'scheduler' ? 'schedule' : module.module_name}`)
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