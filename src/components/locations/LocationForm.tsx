import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Location } from '../../types';
import { useLocations } from '../../contexts/LocationsContext';
import { useSchool } from '../../contexts/SchoolContext';

interface LocationFormProps {
  isOpen: boolean;
  onClose: () => void;
  location?: Location;
}

const defaultLocation: Omit<Location, 'id' | 'school_id' | 'created_at' | 'updated_at'> = {
  name: ''
};

const LocationForm = ({ isOpen, onClose, location }: LocationFormProps) => {
  const [formData, setFormData] = useState(defaultLocation);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { createLocation, updateLocation, loading, error } = useLocations();
  const { isSchoolAdmin } = useSchool();

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name
      });
    } else {
      setFormData(defaultLocation);
    }
    setErrors({});
  }, [location, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Location name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Location name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Location name must be less than 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !isSchoolAdmin) return;

    try {
      if (location) {
        // Editing existing location
        await updateLocation({
          id: location.id,
          name: formData.name.trim()
        });
      } else {
        // Creating new location
        await createLocation({
          name: formData.name.trim()
        });
      }
      onClose();
    } catch (err) {
      console.error('Error saving location:', err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isSchoolAdmin) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Only school administrators can create or edit locations.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {location ? 'Edit Location' : 'Add New Location'}
          </DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Location Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter location name (e.g., Room 101, Music Hall, Gym)"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : (location ? 'Update Location' : 'Create Location')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LocationForm; 