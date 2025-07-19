import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useSchools, SchoolWithRole } from '@schooltools/shared-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Shield, ChevronDown } from 'lucide-react'
import SchoolSelector from '../components/schools/SchoolSelector.tsx'
import ModuleSelector from '../components/modules/ModuleSelector.tsx'

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const { schools, loading } = useSchools()
  const navigate = useNavigate()
  const [selectedSchool, setSelectedSchool] = React.useState<SchoolWithRole | null>(null)
  const [showSchoolGrid, setShowSchoolGrid] = React.useState(true)

  // Initialize selected school from localStorage
  React.useEffect(() => {
    const lastSchoolId = localStorage.getItem('last_selected_school')
    if (lastSchoolId && schools.length > 0) {
      const school = schools.find(school => school.id === lastSchoolId)
      if (school) {
        setSelectedSchool(school)
        setShowSchoolGrid(false) // Hide grid when school is auto-selected
      }
    }
  }, [schools])

  const handleSchoolSelect = (schoolId: string | null) => {
    if (schoolId === null) {
      setSelectedSchool(null)
      localStorage.removeItem('last_selected_school')
      setShowSchoolGrid(true)
      return
    }
    
    const school = schools.find(s => s.id === schoolId)
    if (school) {
      setSelectedSchool(school)
      setShowSchoolGrid(false) // Hide grid when school is selected
    }
  }

  const toggleSchoolGrid = () => {
    setShowSchoolGrid(!showSchoolGrid)
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  // Get schools where user has admin privileges
  const adminSchools = schools.filter(school => 
    school.userRole === 'admin' || school.userRole === 'superadmin'
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading your schools...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">SchoolTools</h1>
              <p className="text-gray-600">Central Hub</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user?.name}</span>
              <Button variant="outline" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {schools.length === 0 ? (
          <div className="text-center py-12">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Welcome to SchoolTools!</CardTitle>
                <CardDescription>
                  Get started by creating a new school for your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/school-setup')}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create School
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Administrative Actions */}
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={() => navigate('/school-setup')}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New School
              </Button>
              
              {adminSchools.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Admin access:</span>
                  {adminSchools.map(school => (
                    <Button
                      key={school.id}
                      onClick={() => navigate(`/school/${school.slug}/manage`)}
                      variant="outline"
                      size="sm"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Manage {school.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* School Selection */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedSchool ? `Selected school: ${selectedSchool.name}` : 'Select Your School'}
                </h2>
                {selectedSchool && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSchoolGrid}
                    className="p-1 h-8 w-8"
                  >
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${showSchoolGrid ? 'rotate-180' : ''}`} 
                    />
                  </Button>
                )}
              </div>
              {showSchoolGrid && (
                <SchoolSelector 
                  onSchoolSelect={handleSchoolSelect} 
                  selectedSchoolId={selectedSchool?.id || null}
                />
              )}
            </div>

            {/* Module Selection - Will show after school is selected */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Module</h2>
              <ModuleSelector 
                schoolId={selectedSchool?.id || undefined} 
                schoolSlug={selectedSchool?.slug || undefined} 
                selectedSchool={selectedSchool}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard 