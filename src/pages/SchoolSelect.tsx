import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSchools } from '../contexts/SchoolsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Building2, Users, Crown, Plus, Loader2, Shield, Trash2 } from 'lucide-react';

const SchoolSelect = () => {
  const { user, isAuthenticated, updateLastAccessedSchool } = useAuth();
  const { schools, fetchUserSchools, loading, deleteSchool, canDeleteSchool } = useSchools();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchUserSchools();
    }
  }, [isAuthenticated, user, navigate, fetchUserSchools]);

  const handleSchoolSelect = async (schoolId: string) => {
    try {
      await updateLastAccessedSchool(schoolId);
    } catch (error) {
      console.error('Error updating last accessed school:', error);
      // Continue with navigation even if updating preference fails
    }
    navigate(`/school/${schoolId}/schedule`);
  };

  const handleDeleteClick = async (school: { id: string; name: string }) => {
    setSchoolToDelete(school);
    
    // Check if user can delete this school
    const canDelete = await canDeleteSchool(school.id);
    
    if (canDelete) {
      setDeleteModalOpen(true);
    } else {
      setErrorModalOpen(true);
    }
  };

  const handleDeleteSchool = async () => {
    if (!schoolToDelete) return;

    setIsDeleting(true);
    try {
      const success = await deleteSchool(schoolToDelete.id);
      
      if (success) {
        toast({
          title: "School deleted",
          description: `${schoolToDelete.name} has been successfully deleted.`,
        });
        setDeleteModalOpen(false);
        setSchoolToDelete(null);
      } else {
        toast({
          title: "Delete failed",
          description: "Failed to delete the school. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting school:', error);
      toast({
        title: "Delete failed",
        description: "An error occurred while deleting the school.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Card className="w-full max-w-md shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading your schools...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="w-full px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="ml-2 text-2xl font-bold text-gray-900">School Scheduler</span>
          </div>
          <div className="text-right">
            <p className="font-medium text-gray-900">Hello, {user.name}!</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-6 pb-6">
        {schools.length === 0 ? (
          // No schools - show welcome message and options
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Get Started</h1>
              <p className="text-lg text-gray-600">
                Create a new school or join an existing one to begin scheduling
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Create School Card */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary/20">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                    <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Create a New School</CardTitle>
                  <CardDescription className="text-base">
                    Set up a new school and become its administrator. You'll be able to invite teachers and manage all aspects of the school.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/school-setup">
                    <Button className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Create School
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Join School Card */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-secondary/20">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-secondary/10 rounded-full w-fit">
                    <Users className="h-8 w-8 text-secondary" />
                  </div>
                  <CardTitle className="text-xl">Join an Existing School</CardTitle>
                  <CardDescription className="text-base">
                    Enter a join code provided by a school administrator to join their school as a teacher or staff member.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/school-setup">
                    <Button variant="secondary" className="w-full">
                      <Users className="h-4 w-4 mr-2" />
                      Join School
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Has schools - show school selection
          <>
            {/* Schools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-8 max-w-7xl mx-auto">
              {schools.map((school) => (
                <Card 
                  key={school.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleSchoolSelect(school.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Building2 className="h-8 w-8 text-primary" />
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
                              e.stopPropagation();
                              handleDeleteClick({ id: school.id, name: school.name });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-xl">{school.name}</CardTitle>
                    <CardDescription>
                      {school.description || 'No description available'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSchoolSelect(school.id);
                      }}
                    >
                      Enter School
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add School Options */}
            <div className="max-w-2xl mx-auto">
              <Card className="bg-white/70 backdrop-blur-sm border-dashed border-2 border-primary/30">
                <CardContent className="py-8">
                  <div className="text-center">
                    <Plus className="h-12 w-12 text-primary/60 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Need access to another school?
                    </h3>
                    <p className="text-gray-600 mb-6">
                      You can create a new school or join an existing one
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link to="/school-setup">
                        <Button variant="outline" className="w-full sm:w-auto">
                          <Plus className="h-4 w-4 mr-2" />
                          Create New School
                        </Button>
                      </Link>
                      <Link to="/school-setup">
                        <Button variant="outline" className="w-full sm:w-auto">
                          <Users className="h-4 w-4 mr-2" />
                          Join Existing School
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
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
                setDeleteModalOpen(false);
                setSchoolToDelete(null);
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
                setErrorModalOpen(false);
                setSchoolToDelete(null);
              }}
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchoolSelect; 