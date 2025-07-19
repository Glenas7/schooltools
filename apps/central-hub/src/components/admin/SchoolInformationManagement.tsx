import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Save, AlertTriangle } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useSchool, useSchools } from '@schooltools/shared-auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

const SchoolInformationManagement = () => {
  const { currentSchool, userRole, refreshSchool } = useSchool();
  const { fetchUserSchools } = useSchools();
  const { toast } = useToast();
  const navigate = useNavigate();

  // School name editing state (superadmin only)
  const [schoolName, setSchoolName] = useState(currentSchool?.name || '');
  const [isSavingSchoolName, setIsSavingSchoolName] = useState(false);

  // School description editing state (superadmin only)
  const [schoolDescription, setSchoolDescription] = useState(currentSchool?.description || '');
  const [isSavingSchoolDescription, setIsSavingSchoolDescription] = useState(false);

  // School slug editing state (superadmin only)
  const [schoolSlug, setSchoolSlug] = useState(currentSchool?.slug || '');
  const [isSavingSchoolSlug, setIsSavingSchoolSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Sync state when currentSchool changes
  useEffect(() => {
    setSchoolName(currentSchool?.name || '');
    setSchoolDescription(currentSchool?.description || '');
    setSchoolSlug(currentSchool?.slug || '');
  }, [currentSchool?.name, currentSchool?.description, currentSchool?.slug]);

  const handleSaveSchoolName = async () => {
    if (!currentSchool || !schoolName.trim()) return;
    
    setIsSavingSchoolName(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ name: schoolName.trim() })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      if (refreshSchool) {
        await refreshSchool();
      }
      
      toast({
        title: "School name updated",
        description: "The school name has been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating school name:', error);
      toast({
        title: "Error",
        description: `Failed to update school name: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsSavingSchoolName(false);
    }
  };

  const handleSaveSchoolDescription = async () => {
    if (!currentSchool || !schoolDescription.trim()) return;
    
    setIsSavingSchoolDescription(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ description: schoolDescription.trim() })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      if (refreshSchool) {
        await refreshSchool();
      }
      
      toast({
        title: "School description updated",
        description: "The school description has been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating school description:', error);
      toast({
        title: "Error",
        description: `Failed to update school description: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsSavingSchoolDescription(false);
    }
  };

  const validateSlug = (slug: string): string | null => {
    if (!slug.trim()) {
      return 'URL path is required';
    }
    
    if (slug.length < 3) {
      return 'URL path must be at least 3 characters';
    }
    
    if (slug.length > 50) {
      return 'URL path must be 50 characters or less';
    }
    
    if (!/^[a-z0-9]+([a-z0-9\-]*[a-z0-9]+)*$/.test(slug)) {
      return 'URL path can only contain lowercase letters, numbers, and hyphens (no consecutive hyphens)';
    }
    
    return null;
  };

  const handleSlugChange = (value: string) => {
    setSchoolSlug(value);
    const error = validateSlug(value);
    setSlugError(error);
  };

  const handleSaveSchoolSlug = async () => {
    if (!currentSchool || !schoolSlug.trim()) return;
    
    const validationError = validateSlug(schoolSlug);
    if (validationError) {
      setSlugError(validationError);
      return;
    }
    
    setIsSavingSchoolSlug(true);
    try {
      // Check if slug is available using the backend function
      const { data: isValid, error: validationQueryError } = await supabase
        .rpc('is_valid_school_slug', { 
          input_slug: schoolSlug.trim().toLowerCase(),
          exclude_school_id: currentSchool.id 
        });

      if (validationQueryError) {
        throw validationQueryError;
      }

      if (!isValid) {
        setSlugError('This URL path is already taken or reserved. Please choose another.');
        return;
      }

      const { error } = await supabase
        .from('schools')
        .update({ slug: schoolSlug.trim().toLowerCase() })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      if (refreshSchool) {
        await refreshSchool();
      }
      
      // Also refresh the schools list in SchoolsProvider to update Dashboard URLs
      await fetchUserSchools();
      
      toast({
        title: "School URL path updated",
        description: "The school URL path has been updated successfully.",
      });
      
      setSlugError(null);
      
      // Navigate to the new URL with the updated slug
      navigate(`/school/${schoolSlug.trim().toLowerCase()}/manage`, { replace: true });
    } catch (error: any) {
      console.error('Error updating school slug:', error);
      
      let errorMessage = `Failed to update school URL path: ${error.message}`;
      
      // Handle specific database errors
      if (error.code === '23505') {
        errorMessage = 'This URL path is already taken by another school. Please choose a different one.';
        setSlugError('This URL path is already taken by another school.');
      } else if (error.message?.includes('duplicate key')) {
        errorMessage = 'This URL path is already taken. Please choose a different one.';
        setSlugError('This URL path is already taken.');
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSavingSchoolSlug(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* School Name Management Section - Only for Super Admins */}
      {userRole === 'superadmin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              School Information Management
            </CardTitle>
            <CardDescription>Manage basic school information (Super Admin only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">School Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="school-name"
                    type="text"
                    placeholder="Enter school name"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSaveSchoolName}
                    disabled={isSavingSchoolName || !schoolName.trim() || schoolName === currentSchool?.name}
                    size="sm"
                    variant="outline"
                  >
                    {isSavingSchoolName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Change the name of the school. This will be reflected throughout the application.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-description">School Description</Label>
                <div className="flex gap-2">
                  <Input
                    id="school-description"
                    type="text"
                    placeholder="Enter school description (optional)"
                    value={schoolDescription}
                    onChange={(e) => setSchoolDescription(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSaveSchoolDescription}
                    disabled={isSavingSchoolDescription || schoolDescription === currentSchool?.description}
                    size="sm"
                    variant="outline"
                  >
                    {isSavingSchoolDescription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add or change the school description. This will help with school identification.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-slug">School URL Path</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="flex">
                      <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-md">
                        schooltools.online/
                      </span>
                      <Input
                        id="school-slug"
                        type="text"
                        placeholder="your-school-name"
                        value={schoolSlug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        className={`rounded-l-none ${slugError ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {slugError && <p className="text-sm text-red-500 mt-1">{slugError}</p>}
                  </div>
                  <Button 
                    onClick={handleSaveSchoolSlug}
                    disabled={isSavingSchoolSlug || !!slugError || schoolSlug === currentSchool?.slug}
                    size="sm"
                    variant="outline"
                  >
                    {isSavingSchoolSlug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Set a custom URL path for your school. This will be used in all module URLs (e.g., scheduler.schooltools.online/your-path). 
                  Only lowercase letters, numbers, and hyphens allowed.
                </p>
              </div>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900 mb-1">Important Note</h4>
                  <p className="text-sm text-amber-800">
                    Changing the school name and description will update them everywhere in the application. Make sure this is intentional as it affects all users and reports.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SchoolInformationManagement; 