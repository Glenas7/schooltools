import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Subject } from '../../types';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useSchool } from '../../contexts/SchoolContext';

interface SubjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: Subject;
}

const defaultSubject: Omit<Subject, 'id' | 'school_id' | 'created_at' | 'updated_at'> = {
  name: '',
  color: '#9b87f5', // Default color
  active: true
};

// Predefined color options
const colorOptions = [
  '#9b87f5', // Primary Purple
  '#F97316', // Bright Orange
  '#0EA5E9', // Ocean Blue
  '#D946EF', // Magenta Pink
  '#8B5CF6', // Vivid Purple
  '#F43F5E', // Red
  '#10B981', // Green
  '#FBBF24', // Yellow
];

const SubjectForm = ({ isOpen, onClose, subject }: SubjectFormProps) => {
  const [formData, setFormData] = useState(defaultSubject);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { createSubject, updateSubject, loading, error } = useSubjects();
  const { isSchoolAdmin } = useSchool();

  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name,
        color: subject.color,
        active: subject.active
      });
    } else {
      setFormData(defaultSubject);
    }
    setErrors({});
  }, [subject, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Subject name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Subject name must be at least 2 characters';
    }

    if (!formData.color) {
      newErrors.color = 'Color is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !isSchoolAdmin) return;

    try {
      if (subject) {
        // Editing existing subject
        await updateSubject({
          id: subject.id,
          name: formData.name.trim(),
          color: formData.color,
          active: formData.active
        });
      } else {
        // Creating new subject
        await createSubject({
          name: formData.name.trim(),
          color: formData.color,
          active: formData.active
        });
      }
      onClose();
    } catch (err) {
      console.error('Error saving subject:', err);
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
              Only school administrators can create or edit subjects.
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
            {subject ? 'Edit Subject' : 'Add New Subject'}
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
            <Label htmlFor="name">Subject Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter subject name (e.g., Piano, Guitar, Mathematics)"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color
                      ? 'border-gray-800 scale-110'
                      : 'border-gray-300 hover:border-gray-500'
                  } transition-all`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleInputChange('color', color)}
                />
              ))}
            </div>
            <Input
              id="color"
              type="color"
              value={formData.color}
              onChange={(e) => handleInputChange('color', e.target.value)}
              className="w-full h-10"
            />
            {errors.color && <p className="text-sm text-red-500">{errors.color}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : (subject ? 'Update Subject' : 'Create Subject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubjectForm; 