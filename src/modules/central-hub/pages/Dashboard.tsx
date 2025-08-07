import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useSchools, SchoolWithRole } from '@/core/contexts'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Plus } from 'lucide-react'
import SchoolSelector from '../components/schools/SchoolSelector.tsx'
import AddSchoolModal from '../components/schools/AddSchoolModal.tsx'
import ModuleSelector from '../components/modules/ModuleSelector.tsx'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { schools, loading } = useSchools()
  const [selectedSchool, setSelectedSchool] = React.useState<SchoolWithRole | null>(null)
  const [showSchoolGrid, setShowSchoolGrid] = React.useState(true)
  const [showAddSchoolModal, setShowAddSchoolModal] = React.useState(false)

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
      // Redirect to central hub login after logout
      navigate('/login')
    } catch (error) {
      console.error('Error logging out:', error)
      // Even if logout fails, redirect to login page
      navigate('/login')
    }
  }



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
                  onClick={() => setShowAddSchoolModal(true)}
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
            {/* School Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedSchool ? `Selected school: ${selectedSchool.name}` : 'Select Your School'}
                </h2>
                <Button 
                  onClick={() => setShowAddSchoolModal(true)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New School
                </Button>
              </div>
              <SchoolSelector 
                onSchoolSelect={handleSchoolSelect} 
                selectedSchoolId={selectedSchool?.id || null}
                showAllSchools={showSchoolGrid}
                onToggleShowAll={toggleSchoolGrid}
              />
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

      {/* Add School Modal */}
      <AddSchoolModal 
        isOpen={showAddSchoolModal}
        onClose={() => setShowAddSchoolModal(false)}
      />
    </div>
  )
}

export default Dashboard 