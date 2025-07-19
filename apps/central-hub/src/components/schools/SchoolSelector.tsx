import React, { useState, useEffect } from 'react'
import { useSchools } from '@schooltools/shared-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Building2, Users, Crown, Shield, Trash2, Loader2, Calendar, UtensilsCrossed } from 'lucide-react'

interface SchoolSelectorProps {
  onSchoolSelect?: (schoolId: string | null) => void
  selectedSchoolId?: string | null // Add this prop to sync with parent
}

// Helper function to get module icon
const getModuleIcon = (moduleName: string) => {
  switch (moduleName) {
    case 'scheduler':
      return <Calendar className="h-3 w-3" />
    case 'lunch-menu':
      return <UtensilsCrossed className="h-3 w-3" />
    default:
      return <div className="h-3 w-3 bg-gray-400 rounded" />
  }
}

// Helper function to get role color
const getRoleColor = (role: string) => {
  switch (role) {
    case 'superadmin':
      return 'text-purple-600 bg-purple-100'
    case 'admin':
      return 'text-yellow-600 bg-yellow-100'
    case 'editor':
      return 'text-green-600 bg-green-100'
    case 'teacher':
    case 'viewer':
      return 'text-blue-600 bg-blue-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

const SchoolSelector: React.FC<SchoolSelectorProps> = ({ onSchoolSelect, selectedSchoolId: propSelectedSchoolId }) => {
  const { schools, deleteSchool, canDeleteSchool } = useSchools()
  const { toast } = useToast()
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null)

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [schoolToDelete, setSchoolToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Initialize from localStorage on mount
  useEffect(() => {
    const lastSchoolId = localStorage.getItem('last_selected_school')
    if (lastSchoolId && !selectedSchoolId) {
      setSelectedSchoolId(lastSchoolId)
    }
  }, [])

  // Sync with prop changes from parent
  useEffect(() => {
    if (propSelectedSchoolId !== undefined) {
      setSelectedSchoolId(propSelectedSchoolId)
    }
  }, [propSelectedSchoolId])

  // Auto-select if user has only one school
  useEffect(() => {
    if (schools.length === 1 && !selectedSchoolId) {
      const schoolId = schools[0].id
      setSelectedSchoolId(schoolId)
      onSchoolSelect?.(schoolId)
    }
  }, [schools, selectedSchoolId, onSchoolSelect])

  const handleSchoolSelect = (schoolId: string) => {
    setSelectedSchoolId(schoolId)
    onSchoolSelect?.(schoolId)
    // Store selection for future reference
    localStorage.setItem('last_selected_school', schoolId)
  }

  const handleDeleteClick = async (school: { id: string; name: string }) => {
    setSchoolToDelete(school)
    
    // Check if user can delete this school
    const canDelete = await canDeleteSchool(school.id)
    
    if (canDelete) {
      setDeleteModalOpen(true)
    } else {
      setErrorModalOpen(true)
    }
  }

  const handleDeleteSchool = async () => {
    if (!schoolToDelete) return

    setIsDeleting(true)
    try {
      const success = await deleteSchool(schoolToDelete.id)
      
      if (success) {
        toast({
          title: "School deleted",
          description: `${schoolToDelete.name} has been successfully deleted.`,
        })
        setDeleteModalOpen(false)
        setSchoolToDelete(null)
        
        // If the deleted school was selected, clear the selection
        if (selectedSchoolId === schoolToDelete.id) {
          setSelectedSchoolId(null)
          onSchoolSelect?.(null)
        }
      } else {
        toast({
          title: "Delete failed",
          description: "Failed to delete the school. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error deleting school:', error)
      toast({
        title: "Delete failed",
        description: "An error occurred while deleting the school.",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (schools.length === 0) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>No Schools Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            You don't have access to any schools yet. Contact your administrator.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (schools.length === 1) {
    const school = schools[0]
    return (
      <Card className="max-w-md border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <Building2 className="h-8 w-8 text-green-600" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                {school.userRole === 'superadmin' ? (
                  <>
                    <Shield className="h-3 w-3 text-purple-500" />
                    <span className="text-purple-600 font-medium">Super Admin</span>
                  </>
                ) : school.userRole === 'admin' ? (
                  <>
                    <Crown className="h-3 w-3 text-yellow-500" />
                    <span className="text-yellow-600 font-medium">Admin</span>
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3 text-blue-500" />
                    <span className="text-blue-600 font-medium">Teacher</span>
                  </>
                )}
              </div>
              {school.userRole === 'superadmin' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteClick({ id: school.id, name: school.name })
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <CardTitle className="text-green-800">Selected School</CardTitle>
          <CardDescription className="text-green-700">
            {school.name} - {school.description || 'No description available'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Module Access */}
          {school.modules && school.modules.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-green-700 mb-2">Module Access:</h4>
              <div className="flex flex-wrap gap-1">
                {school.modules.map((module) => (
                  <div
                    key={module.module_id}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(module.user_role)}`}
                  >
                    {getModuleIcon(module.module_name)}
                    <span className="capitalize">{module.module_display_name}</span>
                    <span className="text-xs opacity-70">({module.user_role})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-green-600 font-medium">✓ Automatically selected</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {schools.map((school) => (
          <Card 
            key={school.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedSchoolId === school.id 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'hover:border-gray-400'
            }`}
            onClick={() => handleSchoolSelect(school.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <Building2 className="h-6 w-6 text-primary" />
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs">
                    {school.userRole === 'superadmin' ? (
                      <>
                        <Shield className="h-3 w-3 text-purple-500" />
                        <span className="text-purple-600 font-medium">Super Admin</span>
                      </>
                    ) : school.userRole === 'admin' ? (
                      <>
                        <Crown className="h-3 w-3 text-yellow-500" />
                        <span className="text-yellow-600 font-medium">Admin</span>
                      </>
                    ) : (
                      <>
                        <Users className="h-3 w-3 text-blue-500" />
                        <span className="text-blue-600 font-medium">Teacher</span>
                      </>
                    )}
                  </div>
                  {school.userRole === 'superadmin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick({ id: school.id, name: school.name })
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <CardTitle className="text-base">{school.name}</CardTitle>
              <CardDescription className="text-sm">
                {school.description || 'No description available'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Module Access */}
              {school.modules && school.modules.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Module Access:</h4>
                  <div className="flex flex-wrap gap-1">
                    {school.modules.map((module) => (
                      <div
                        key={module.module_id}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(module.user_role)}`}
                      >
                        {getModuleIcon(module.module_name)}
                        <span className="capitalize">{module.module_display_name}</span>
                        <span className="text-xs opacity-70">({module.user_role})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                {selectedSchoolId === school.id ? (
                  <span className="text-blue-600 font-medium">Selected ✓</span>
                ) : (
                  <Button variant="outline" size="sm">
                    Select
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete School</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{schoolToDelete?.name}</strong>? 
              This action will permanently remove the school and all its associated data from the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteModalOpen(false)
                setSchoolToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteSchool}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete School
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Delete School</DialogTitle>
            <DialogDescription>
              This school cannot be deleted because there are other administrators. 
              Schools can only be deleted when you are the sole administrator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              onClick={() => {
                setErrorModalOpen(false)
                setSchoolToDelete(null)
              }}
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default SchoolSelector 