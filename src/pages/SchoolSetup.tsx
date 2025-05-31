import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSchools } from '../contexts/SchoolsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Plus, Users, Building2, Loader2 } from 'lucide-react';

const SchoolSetup = () => {
  const { user, isAuthenticated, updateLastAccessedSchool } = useAuth();
  const { schools, createSchool, joinSchool, fetchUserSchools } = useSchools();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchUserSchools();
    }
  }, [isAuthenticated, user, navigate, fetchUserSchools]);

  // Remove the automatic redirect for users with schools
  // Users should be able to create additional schools

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    setIsLoading(true);

    try {
      const newSchool = await createSchool({
        name: newSchoolName.trim()
      });

      if (newSchool) {
        toast({
          title: "School created successfully!",
          description: `Welcome to ${newSchool.name}! You are now the administrator.`,
        });
        
        // Navigate to the new school's dashboard
        navigate(`/school/${newSchool.id}/schedule`);
        updateLastAccessedSchool(newSchool.id);
      }
    } catch (error: any) {
      console.error('Create school error:', error);
      toast({
        title: "Failed to create school",
        description: error.message || "Unable to create school. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!joinCode.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a school join code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const school = await joinSchool(joinCode.trim());

      if (school) {
        toast({
          title: "Successfully joined school!",
          description: `Welcome to ${school.name}!`,
        });
        
        // Navigate to the school's dashboard
        navigate(`/school/${school.id}/schedule`);
        updateLastAccessedSchool(school.id);
      }
    } catch (error: any) {
      console.error('Join school error:', error);
      toast({
        title: "Failed to join school",
        description: error.message || "Invalid join code or unable to join school.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-10 w-10 text-primary" />
            <span className="ml-2 text-3xl font-bold text-gray-900">School Scheduler</span>
          </div>
          {schools.length > 0 && (
            <div className="mb-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/school-select')}
                className="mb-2"
              >
                ← Back to Schools
              </Button>
            </div>
          )}
          <CardTitle className="text-2xl">Welcome, {user.name}!</CardTitle>
          <CardDescription className="text-lg">
            {schools.length > 0 
              ? "Create a new school or join an additional school."
              : "To get started, you can either create a new school or join an existing one."
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create School
              </TabsTrigger>
              <TabsTrigger value="join" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Join School
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Create a New School
                  </CardTitle>
                  <CardDescription>
                    Set up a new school and become its administrator. You'll be able to invite teachers and manage all aspects of the school.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateSchool} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="schoolName" className="text-sm font-medium">
                        School Name
                      </label>
                      <Input
                        id="schoolName"
                        type="text"
                        placeholder="e.g., Lincoln Elementary School, Music Academy Downtown"
                        value={newSchoolName}
                        onChange={(e) => setNewSchoolName(e.target.value)}
                        required
                      />
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating School...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create School
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="join" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Join an Existing School
                  </CardTitle>
                  <CardDescription>
                    Enter a join code provided by a school administrator to join their school as a teacher or staff member.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleJoinSchool} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="joinCode" className="text-sm font-medium">
                        School Join Code
                      </label>
                      <Input
                        id="joinCode"
                        type="text"
                        placeholder="Enter the join code provided by your administrator"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Join codes are typically 6-8 characters long and case-insensitive.
                      </p>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Joining School...
                        </>
                      ) : (
                        <>
                          <Users className="mr-2 h-4 w-4" />
                          Join School
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolSetup; 