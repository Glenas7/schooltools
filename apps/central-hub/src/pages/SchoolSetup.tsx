import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSchools } from '@schooltools/shared-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Plus, Building2, Loader2 } from 'lucide-react';

const SchoolSetup = () => {
  const { user, isAuthenticated, updateLastAccessedSchool } = useAuth();
  const { schools, createSchool, fetchUserSchools } = useSchools();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchUserSchools();
    }
  }, [isAuthenticated, user, navigate, fetchUserSchools]);

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
        
        // Navigate to dashboard with new school selected
        await updateLastAccessedSchool(newSchool.id);
        navigate('/', { replace: true });
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
            <span className="ml-2 text-3xl font-bold text-gray-900">SchoolTools</span>
          </div>
          {schools.length > 0 && (
            <div className="mb-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="mb-2"
              >
                ← Back to Dashboard
              </Button>
            </div>
          )}
          <CardTitle className="text-2xl">Welcome, {user.name}!</CardTitle>
          <CardDescription className="text-lg">
            {schools.length > 0 
              ? "Create a new school to add to your dashboard."
              : "Create a new school to get started with SchoolTools."
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Create a New School
              </CardTitle>
              <CardDescription>
                Set up a new school and become its administrator. You'll be able to add modules and manage all aspects of the school.
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
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolSetup; 