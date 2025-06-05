import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSchools } from '../contexts/SchoolsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Building2, Users, Crown, Plus, Loader2, Shield } from 'lucide-react';

const SchoolSelect = () => {
  const { user, isAuthenticated, updateLastAccessedSchool } = useAuth();
  const { schools, fetchUserSchools, loading } = useSchools();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="ml-2 text-2xl font-bold text-gray-900">School Scheduler</span>
          </div>
          <div className="text-right">
            <p className="font-medium text-gray-900">Welcome back, {user.name}!</p>
            <p className="text-sm text-gray-600">Select a school to continue</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {schools.length === 0 ? (
          // No schools - show welcome message and options
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to School Scheduler!</h1>
              <p className="text-lg text-gray-600">
                To get started, you can either create a new school or join an existing one
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
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Schools</h1>
              <p className="text-lg text-gray-600">
                Choose a school to access its scheduling system
              </p>
            </div>

            {/* Schools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {schools.map((school) => (
                <Card 
                  key={school.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleSchoolSelect(school.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Building2 className="h-8 w-8 text-primary" />
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
            <Card className="bg-gray-50 border-dashed border-2 border-gray-300">
              <CardContent className="py-8">
                <div className="text-center">
                  <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          </>
        )}
      </div>
    </div>
  );
};

export default SchoolSelect; 