import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Teacher } from '../../types';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useSchool } from '../../contexts/SchoolContext';

// Define and export TeacherFormData
export interface TeacherFormData {
  id?: string; // Optional for new teachers
  name: string;
  email: string; // Email is needed for creation, and might be displayed for editing
  active: boolean;
  subjectIds: string[]; // renamed from instrumentIds
}

interface TeacherFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (teacher: TeacherFormData) => void; // Use TeacherFormData here
  teacher?: Teacher; // This is the full Teacher object for editing
  loading?: boolean;
}

// Default form data based on TeacherFormData
const defaultTeacherFormData: TeacherFormData = {
  name: '',
  email: '',
  active: true, // Default for new teachers in form
  subjectIds: []
};

const TeacherForm = ({ isOpen, onClose, onSave, teacher, loading }: TeacherFormProps) => {
  const [formData, setFormData] = useState<TeacherFormData>(defaultTeacherFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { subjects } = useSubjects();
  const { isSchoolAdmin, currentSchool } = useSchool();
  
  useEffect(() => {
    if (teacher) {
      // When editing, map the Teacher object to TeacherFormData
      setFormData({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        active: teacher.active,
        subjectIds: teacher.subjectIds || [] // Ensure subjectIds is an array
      });
    } else {
      setFormData(defaultTeacherFormData);
    }
    setErrors({});
  }, [teacher, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const handleSubjectToggle = (subjectId: string) => {
    setFormData(prev => {
      const subjectIds = [...prev.subjectIds];
      const index = subjectIds.indexOf(subjectId);
      
      if (index > -1) {
        subjectIds.splice(index, 1);
      } else {
        subjectIds.push(subjectId);
      }
      
      return { ...prev, subjectIds };
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    onSave(formData); // formData is already TeacherFormData
  };

  if (!isSchoolAdmin) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
            <DialogDescription>
              You don't have permission to manage teachers.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Only school administrators can create or edit teachers.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!currentSchool) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No School Selected</DialogTitle>
            <DialogDescription>
              Please select a school to continue.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please select a school to manage teachers.
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {teacher ? 'Edit Teacher' : 'Add New Teacher'} - {currentSchool.name}
          </DialogTitle>
          <DialogDescription>
            {teacher 
              ? 'Update teacher information and subject assignments.' 
              : 'Create a new teacher account and assign subjects.'
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? 'border-red-500' : ''}
                  required
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? 'border-red-500' : (teacher ? 'bg-gray-100 cursor-not-allowed' : '')}
                  required
                  readOnly={!!teacher}
                  disabled={!!teacher}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                {teacher && (
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed for existing teachers
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Subjects</label>
              {subjects.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No subjects available. Please create subjects first before adding teachers.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {subjects.map(subject => (
                    <div key={subject.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`subject-${subject.id}`}
                        checked={formData.subjectIds.includes(subject.id)}
                        onCheckedChange={() => handleSubjectToggle(subject.id)}
                      />
                      <label
                        htmlFor={`subject-${subject.id}`}
                        className="text-sm flex items-center cursor-pointer"
                      >
                        <div 
                          className="w-3 h-3 rounded-full mr-1" 
                          style={{ backgroundColor: subject.color }}
                        ></div>
                        {subject.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, active: checked === true }))
                }
              />
              <label htmlFor="active" className="text-sm font-medium cursor-pointer">
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={subjects.length === 0 || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {teacher ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                `${teacher ? 'Update' : 'Add'} Teacher`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherForm;
