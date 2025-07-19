import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pencil, ToggleLeft, ToggleRight, Users, InfoIcon } from 'lucide-react';
import { Teacher } from '../../types';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useSchool } from '../../contexts/SchoolContextWrapper';

interface TeacherListProps {
  teachers: Teacher[];
  onEditTeacher: (teacher: Teacher) => void;
  onToggleActive: (teacherId: string) => void;
  loading?: boolean;
}

const TeacherList = ({ teachers, onEditTeacher, onToggleActive, loading }: TeacherListProps) => {
  const { subjects } = useSubjects();
  const { isSchoolAdmin, currentSchool } = useSchool();

  if (!currentSchool) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teacher List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Please select a school to view teachers.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teacher List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading teachers...</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Teacher List ({teachers.length}) - {currentSchool.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teachers.length === 0 ? (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              No teachers have been added to {currentSchool.name} yet.
              {isSchoolAdmin && " Click the 'Add Teacher' button to invite your first teacher."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Subjects</th>
                  <th className="text-left py-3 px-4">Status</th>
                  {isSchoolAdmin && <th className="text-right py-3 px-4">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {teachers.map(teacher => (
                  <tr key={teacher.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{teacher.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{teacher.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {teacher.subjectIds && teacher.subjectIds.length > 0 ? (
                          teacher.subjectIds.map(id => {
                          const subject = subjects.find(s => s.id === id);
                          return subject ? (
                            <Badge 
                              key={id}
                              style={{ backgroundColor: subject.color }}
                              className="text-white text-xs"
                            >
                              {subject.name}
                            </Badge>
                          ) : (
                            <Badge key={id} variant="outline" className="text-xs">
                              Unknown Subject
                            </Badge>
                          );
                          })
                        ) : (
                          <span className="text-gray-400 text-sm">No subjects assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={teacher.active ? "default" : "secondary"}>
                        {teacher.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {isSchoolAdmin && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onToggleActive(teacher.id)}
                            title={teacher.active ? 'Deactivate teacher' : 'Activate teacher'}
                          >
                            {teacher.active ? (
                              <ToggleRight className="h-4 w-4 mr-1" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 mr-1" />
                            )}
                            {teacher.active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onEditTeacher(teacher)}
                            title="Edit teacher details"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeacherList;
