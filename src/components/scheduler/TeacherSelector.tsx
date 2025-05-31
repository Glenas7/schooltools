import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTeachers } from '../../hooks/useTeachers';

interface TeacherSelectorProps {
  selectedTeacherId: string;
  onTeacherChange: (teacherId: string) => void;
}

const TeacherSelector = ({ selectedTeacherId, onTeacherChange }: TeacherSelectorProps) => {
  const { teachers } = useTeachers();
  const activeTeachers = teachers.filter(teacher => teacher.active);
  
  return (
    <div className="mb-2">
      <label htmlFor="teacher-select" className="block text-sm font-medium text-gray-700 mb-1">
        Select Teacher
      </label>
      <Select value={selectedTeacherId} onValueChange={onTeacherChange}>
        <SelectTrigger id="teacher-select" className="w-[300px]">
          <SelectValue placeholder="Select a teacher" />
        </SelectTrigger>
        <SelectContent>
          {activeTeachers.map(teacher => (
            <SelectItem key={teacher.id} value={teacher.id}>
              {teacher.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TeacherSelector;
