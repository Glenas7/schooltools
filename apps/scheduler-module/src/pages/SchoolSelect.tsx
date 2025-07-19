import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextWrapper';
import { useSchools } from '../contexts/SchoolsContextWrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Building2, Users, Crown, Plus, Loader2, Shield } from 'lucide-react';

const SchoolSelect = () => {
  const { user, isAuthenticated, updateLastAccessedSchool } = useAuth();
  const { schools, fetchUserSchools, loading } = useSchools();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Remove delete modal state - school deletion is handled at dashboard level

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
    
    // Find the selected school to get its slug
    const selectedSchool = schools.find(school => school.id === schoolId);
    const schoolIdentifier = selectedSchool?.slug || schoolId; // Prefer slug over ID
    
    navigate(`/school/${schoolIdentifier}/schedule`);
  };

  // School deletion is handled at the dashboard level, not here

  if (!user) {
    return (
      <div className="w-full px-6 py-8 flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full px-6 py-8 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading your schools...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-8">
      {schools.length === 0 ? (
        // No schools - show welcome message and options
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to School Scheduler!</h1>
            <p className="text-lg text-gray-600">
              To get started, create a new school for your organization
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Create School Card */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary/20 bg-white">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                  <Plus className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Create a New School</CardTitle>
                <CardDescription className="text-base">
                  Set up a new school and become its administrator. You'll be able to add modules and manage all aspects of the school.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => window.open('https://app.schooltools.online/school-setup', '_blank')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create School
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        // Has schools - show school selection
        <>
          <div className="text-center mb-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose a school to access its scheduling system</h1>
          </div>

          {/* Schools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-8 max-w-7xl mx-auto">
            {schools.map((school) => (
              <Card 
                key={school.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow bg-white"
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
                      {/* Delete button removed - school deletion handled at dashboard level */}
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
          <Card className="bg-white border-dashed border-2 border-gray-300 max-w-2xl mx-auto">
            <CardContent className="py-8">
              <div className="text-center">
                <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Need access to another school?
                </h3>
                <p className="text-gray-600 mb-6">
                  Create a new school to add to your dashboard
                </p>
                <div className="flex justify-center">
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto"
                    onClick={() => window.open('https://app.schooltools.online/school-setup', '_blank')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New School
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete modals removed - school deletion handled at dashboard level */}
    </div>
  );
};

export default SchoolSelect; 