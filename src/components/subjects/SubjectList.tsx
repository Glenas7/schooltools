import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Trash, InfoIcon, BookOpen } from 'lucide-react';
import { Subject } from '../../types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useSchool } from '../../contexts/SchoolContext';

interface SubjectListProps {
  subjects: Subject[];
  onEditSubject: (subject: Subject) => void;
  onDeleteSubject: (id: string) => void;
}

const SubjectList = ({ subjects, onEditSubject, onDeleteSubject }: SubjectListProps) => {
  const { loading, error } = useSubjects();
  const { isSchoolAdmin, currentSchool } = useSchool();

  if (!currentSchool) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subject List</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Please select a school to view subjects.
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
          <CardTitle>Subject List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading subjects...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subject List</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Error loading subjects: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Subject List ({subjects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subjects.length === 0 ? (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              No subjects have been created for {currentSchool.name} yet. 
              {isSchoolAdmin && " Click the 'Add Subject' button to create your first subject."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="font-medium">{subject.name}</span>
                </div>
                {isSchoolAdmin && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditSubject(subject)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteSubject(subject.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubjectList; 