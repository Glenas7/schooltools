import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSchools } from '@/core/contexts';
import { supabase } from '@/core/lib/supabaseClient';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useToast } from '@/shared/components/ui/use-toast';
import { Loader2, Building2 } from 'lucide-react';

interface AddSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddSchoolModal: React.FC<AddSchoolModalProps> = ({ isOpen, onClose }) => {
  const { updateLastAccessedSchool } = useAuth();
  const { createSchool, fetchUserSchools } = useSchools();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: ''
  });
  const [errors, setErrors] = useState({
    name: '',
    slug: ''
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: '', description: '', slug: '' });
      setErrors({ name: '', slug: '' });
    }
  }, [isOpen]);

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

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Real-time slug validation
    if (field === 'slug') {
      const slugError = validateSlug(value);
      setErrors(prev => ({ ...prev, slug: slugError || '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors = { name: '', slug: '' };
    let isValid = true;

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'School name is required';
      isValid = false;
    }

    // Validate slug
    const slugError = validateSlug(formData.slug);
    if (slugError) {
      newErrors.slug = slugError;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Check if slug is available using the backend function
      const { data: isValid, error: validationQueryError } = await supabase
        .rpc('is_valid_school_slug', { 
          input_slug: formData.slug.trim().toLowerCase(),
          exclude_school_id: null // No exclusion for new schools
        });

      if (validationQueryError) {
        throw validationQueryError;
      }

      if (!isValid) {
        setErrors(prev => ({ 
          ...prev, 
          slug: 'This URL path is already taken or reserved. Please choose another.' 
        }));
        return;
      }

      // Create the school with all the data
      const newSchool = await createSchool({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        slug: formData.slug.trim().toLowerCase()
      });

      if (newSchool) {
        toast({
          title: "School created successfully!",
          description: `Welcome to ${newSchool.name}! You are now the administrator.`,
        });
        
        // Close modal first
        onClose();
        
        // Navigate to dashboard with new school selected
        await updateLastAccessedSchool(newSchool.id);
        
        // Refresh schools list
        await fetchUserSchools();
        
        // Navigate back to the main dashboard where the new school will be available
        navigate(`/`, { replace: true });
      }
    } catch (error: any) {
      console.error('Error creating school:', error);
      
      let errorMessage = `Failed to create school: ${error.message}`;
      
      // Handle specific database errors
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        if (error.message?.includes('slug')) {
          setErrors(prev => ({ ...prev, slug: 'This URL path is already taken.' }));
          errorMessage = 'This URL path is already taken. Please choose a different one.';
        } else {
          errorMessage = 'A school with this information already exists.';
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create New School
          </DialogTitle>
          <DialogDescription>
            Add a new school to get started with lesson scheduling and management.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* School Name */}
          <div className="space-y-2">
            <Label htmlFor="school-name">
              School Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="school-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Lincoln Elementary School"
              className={errors.name ? 'border-red-500' : ''}
              disabled={isLoading}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="school-description">Description</Label>
            <Textarea
              id="school-description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of your school (optional)"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* URL Path */}
          <div className="space-y-2">
            <Label htmlFor="school-slug">
              URL Path <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">yoursite.com/school/</span>
              <Input
                id="school-slug"
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase())}
                placeholder="lincoln-elementary"
                className={errors.slug ? 'border-red-500' : ''}
                disabled={isLoading}
              />
            </div>
            {errors.slug && <p className="text-sm text-red-500">{errors.slug}</p>}
            <p className="text-xs text-gray-500">
              This will be used in your school's URL. Only lowercase letters, numbers, and hyphens allowed.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !!errors.name || !!errors.slug}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create School
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSchoolModal;