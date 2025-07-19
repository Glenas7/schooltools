import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLessons } from '../../contexts/LessonsContext';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useLocations } from '../../contexts/LocationsContext';
import { useTeachers } from '../../contexts/TeachersContext';
import { Lesson, Location } from '../../types';
import { Clock, User, BookOpen, MapPin, InfoIcon } from 'lucide-react';

interface LocationQueueProps {
  lessonsWithoutLocation: Lesson[];
  onLocationAssigned: () => void;
}

const LocationQueue = ({ lessonsWithoutLocation, onLocationAssigned }: LocationQueueProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const { subjects } = useSubjects();
  const { locations, assignLocationToLesson, loading } = useLocations();
  const { teachers, getTeacherById } = useTeachers();

  const getSubjectById = (subjectId: string) => {
    return subjects.find(subject => subject.id === subjectId);
  };

  const getTeacherName = (teacherId: string | null) => {
    if (!teacherId) return null;
    const teacher = getTeacherById(teacherId);
    return teacher?.name || null;
  };

  // Filter lessons based on search query
  const filteredLessons = lessonsWithoutLocation.filter(lesson => {
    if (!searchQuery.trim()) {
      return true;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const subject = getSubjectById(lesson.subject_id);
    const teacherName = getTeacherName(lesson.teacher_id);
    
    const studentName = lesson.student_name.toLowerCase();
    const subjectName = subject?.name?.toLowerCase() || '';
    const duration = lesson.duration.toString();
    const teacher = teacherName?.toLowerCase() || '';
    
    return studentName.includes(query) || 
           subjectName.includes(query) || 
           duration.includes(query) ||
           teacher.includes(query);
  });

  // Set the first lesson as selected when lessons change
  useEffect(() => {
    console.log('[LocationQueue] useEffect triggered - lessons changed:', {
      lessonsCount: lessonsWithoutLocation.length,
      filteredCount: filteredLessons.length,
      selectedLessonId: selectedLesson?.id,
      selectedLessonInList: selectedLesson ? lessonsWithoutLocation.find(l => l.id === selectedLesson.id) : null,
      firstLessonId: lessonsWithoutLocation[0]?.id,
      firstFilteredLessonId: filteredLessons[0]?.id
    });

    if (lessonsWithoutLocation.length > 0 && !selectedLesson) {
      // Select first lesson from filtered list, fallback to unfiltered
      const firstLesson = filteredLessons[0] || lessonsWithoutLocation[0];
      console.log('[LocationQueue] Setting first lesson as selected:', firstLesson.student_name);
      setSelectedLesson(firstLesson);
    } else if (lessonsWithoutLocation.length === 0) {
      console.log('[LocationQueue] No lessons left, clearing selection');
      setSelectedLesson(null);
    } else if (selectedLesson && !lessonsWithoutLocation.find(l => l.id === selectedLesson.id)) {
      // If selected lesson is no longer in the list, select the first one from filtered list
      const firstLesson = filteredLessons[0] || lessonsWithoutLocation[0];
      console.log('[LocationQueue] Selected lesson no longer in list, selecting new first lesson:', firstLesson?.student_name || 'none');
      setSelectedLesson(firstLesson || null);
    }
  }, [lessonsWithoutLocation, selectedLesson, filteredLessons]);

  // Filter locations based on search query
  const filteredLocations = locations.filter(location => {
    if (!locationSearchQuery.trim()) {
      return true;
    }
    
    const query = locationSearchQuery.toLowerCase().trim();
    return location.name.toLowerCase().includes(query);
  });

  const handleAssignLocation = async (locationId: string) => {
    if (!selectedLesson) return;

    console.log('[LocationQueue] Starting location assignment:', {
      lessonId: selectedLesson.id,
      locationId,
      studentName: selectedLesson.student_name,
      currentLessonsCount: lessonsWithoutLocation.length
    });

    try {
      await assignLocationToLesson(selectedLesson.id, locationId);
      console.log('[LocationQueue] Location assignment completed, calling onLocationAssigned');
      onLocationAssigned();
    } catch (error) {
      console.error('Error assigning location:', error);
    }
  };

  const handleLessonClick = (lesson: Lesson) => {
    setSelectedLesson(lesson);
  };

  if (lessonsWithoutLocation.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-green-600 mb-2">
                All locations assigned!
              </h3>
              <p className="text-muted-foreground">
                There are no lessons pending to have locations assigned to them.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left side - Lessons without location */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lessons without location ({filteredLessons.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Search Bar */}
          <div className="mb-4">
            <Input
              type="search"
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Lessons List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredLessons.map((lesson) => {
              const subject = getSubjectById(lesson.subject_id);
              const teacherName = getTeacherName(lesson.teacher_id);
              const isSelected = selectedLesson?.id === lesson.id;
              
              return (
                <div
                  key={lesson.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => handleLessonClick(lesson)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{lesson.student_name}</span>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        {lesson.duration}min
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <BookOpen className="h-4 w-4 mr-1" />
                        <span>{subject?.name || 'Unknown Subject'}</span>
                      </div>
                      
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        <span>{teacherName || 'Unassigned'}</span>
                      </div>
                    </div>
                    
                    {lesson.day !== null && lesson.start_time && (
                      <div className="text-sm text-muted-foreground">
                        Scheduled: {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][lesson.day]} at {lesson.start_time}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right side - Location assignment */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Assign Location
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {selectedLesson ? (
            <div className="space-y-4">
              {/* Selected lesson info */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium mb-2">Selected Lesson:</h4>
                <div className="space-y-1 text-sm">
                  <div><strong>Student:</strong> {selectedLesson.student_name}</div>
                  <div><strong>Subject:</strong> {getSubjectById(selectedLesson.subject_id)?.name}</div>
                  <div><strong>Duration:</strong> {selectedLesson.duration} minutes</div>
                  <div><strong>Teacher:</strong> {getTeacherName(selectedLesson.teacher_id) || 'Unassigned'}</div>
                  {selectedLesson.day !== null && selectedLesson.start_time && (
                    <div>
                      <strong>Schedule:</strong> {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][selectedLesson.day]} at {selectedLesson.start_time}
                    </div>
                  )}
                </div>
              </div>

              {/* Location buttons */}
              <div className="space-y-2">
                <h4 className="font-medium">Select a location:</h4>
                {locations.length === 0 ? (
                  <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription>
                      No locations have been created yet. Please create some locations first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {/* Location search */}
                    <Input
                      type="search"
                      placeholder="Search locations..."
                      value={locationSearchQuery}
                      onChange={(e) => setLocationSearchQuery(e.target.value)}
                      className="w-full"
                    />
                    
                    {/* Location buttons */}
                    <div className="grid gap-2 max-h-64 overflow-y-auto">
                      {filteredLocations.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No locations match your search.
                        </div>
                      ) : (
                        filteredLocations.map((location) => (
                          <Button
                            key={location.id}
                            variant="outline"
                            className="justify-start"
                            onClick={() => handleAssignLocation(location.id)}
                            disabled={loading}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            {location.name}
                          </Button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MapPin className="mx-auto h-8 w-8 mb-2" />
                <p>Select a lesson from the list to assign a location</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationQueue; 