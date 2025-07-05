import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useLocations } from '../../contexts/LocationsContext';
import { Lesson } from '../../types';
import { Clock, User, BookOpen, MapPin, InfoIcon, Users } from 'lucide-react';

interface BulkLocationAssignmentProps {
  allLessons: Lesson[];
  onLocationAssigned: () => void;
}

const BulkLocationAssignment = ({ allLessons, onLocationAssigned }: BulkLocationAssignmentProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [lessonLocations, setLessonLocations] = useState<Record<string, string>>({});
  const { subjects } = useSubjects();
  const { locations, assignLocationToMultipleLessons, loading, getLessonLocationsBatch } = useLocations();

  // Fetch location data for all lessons
  useEffect(() => {
    const fetchLessonLocations = async () => {
      if (allLessons.length === 0) {
        setLessonLocations({});
        return;
      }

      try {
        const lessonIds = allLessons.map(lesson => lesson.id);
        const locationMap = await getLessonLocationsBatch(lessonIds);
        
        // Convert Location objects to location names for display
        const locationNameMap: Record<string, string> = {};
        Object.entries(locationMap).forEach(([lessonId, location]) => {
          locationNameMap[lessonId] = location.name;
        });
        
        setLessonLocations(locationNameMap);
      } catch (error) {
        console.error('Error fetching lesson locations in batch:', error);
        setLessonLocations({});
      }
    };

    fetchLessonLocations();
  }, [allLessons, getLessonLocationsBatch]);

  const getSubjectById = (subjectId: string) => {
    return subjects.find(subject => subject.id === subjectId);
  };

  const getLessonLocationName = (lessonId: string) => {
    return lessonLocations[lessonId] || null;
  };

  // Filter lessons based on search query
  const filteredLessons = allLessons.filter(lesson => {
    if (!searchQuery.trim()) {
      return true;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const subject = getSubjectById(lesson.subject_id);
    
    const studentName = lesson.student_name.toLowerCase();
    const subjectName = subject?.name?.toLowerCase() || '';
    const duration = lesson.duration.toString();
    
    return studentName.includes(query) || 
           subjectName.includes(query) || 
           duration.includes(query);
  });

  const handleLessonToggle = (lessonId: string, checked: boolean) => {
    if (checked) {
      setSelectedLessonIds(prev => [...prev, lessonId]);
    } else {
      setSelectedLessonIds(prev => prev.filter(id => id !== lessonId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLessonIds(filteredLessons.map(lesson => lesson.id));
    } else {
      setSelectedLessonIds([]);
    }
  };

  const handleAssignLocation = async (locationId: string) => {
    if (selectedLessonIds.length === 0) return;

    try {
      await assignLocationToMultipleLessons(selectedLessonIds, locationId);
      
      // Update location data for the assigned lessons
      const assignedLocation = locations.find(loc => loc.id === locationId);
      if (assignedLocation) {
        const updatedLocationMap = { ...lessonLocations };
        selectedLessonIds.forEach(lessonId => {
          updatedLocationMap[lessonId] = assignedLocation.name;
        });
        setLessonLocations(updatedLocationMap);
      }
      
      setSelectedLessonIds([]); // Clear selection after successful assignment
      onLocationAssigned();
    } catch (error) {
      console.error('Error assigning location to multiple lessons:', error);
    }
  };

  const selectedLessons = allLessons.filter(lesson => selectedLessonIds.includes(lesson.id));
  const isAllFilteredSelected = filteredLessons.length > 0 && filteredLessons.every(lesson => selectedLessonIds.includes(lesson.id));
  const isSomeFilteredSelected = filteredLessons.some(lesson => selectedLessonIds.includes(lesson.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left side - All lessons with multi-select */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Lessons ({filteredLessons.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Search Bar and Select All */}
          <div className="space-y-3 mb-4">
            <Input
              type="search"
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={isAllFilteredSelected}
                onCheckedChange={handleSelectAll}
                className={isSomeFilteredSelected && !isAllFilteredSelected ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Select all visible lessons ({filteredLessons.length})
              </label>
            </div>
          </div>

          {/* Lessons List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredLessons.map((lesson) => {
              const subject = getSubjectById(lesson.subject_id);
              const isSelected = selectedLessonIds.includes(lesson.id);
              
              return (
                <div
                  key={lesson.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={`lesson-${lesson.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleLessonToggle(lesson.id, checked as boolean)}
                      className="mt-1"
                    />
                    
                    <label
                      htmlFor={`lesson-${lesson.id}`}
                      className="flex-1 cursor-pointer"
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
                          
                          {lesson.teacher_id && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              <span>Assigned</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center text-sm">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className={getLessonLocationName(lesson.id) ? 'text-green-600' : 'text-orange-600'}>
                            {getLessonLocationName(lesson.id) || 'No location assigned'}
                          </span>
                        </div>
                        
                        {lesson.day !== null && lesson.start_time && (
                          <div className="text-sm text-muted-foreground">
                            Scheduled: {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][lesson.day]} at {lesson.start_time}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right side - Selected lessons and location assignment */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Bulk Assign Location
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {selectedLessonIds.length > 0 ? (
            <div className="space-y-4">
              {/* Selected lessons summary */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium mb-2">
                  Selected Lessons ({selectedLessonIds.length}):
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                  {selectedLessons.map((lesson) => (
                    <div key={lesson.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium truncate">{lesson.student_name}</span>
                        <div className="flex items-center text-xs">
                          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className={`truncate ${getLessonLocationName(lesson.id) ? 'text-green-600' : 'text-orange-600'}`}>
                            {getLessonLocationName(lesson.id) || 'No location assigned'}
                          </span>
                        </div>
                      </div>
                      <span className="text-muted-foreground text-xs sm:text-sm flex-shrink-0">
                        {getSubjectById(lesson.subject_id)?.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location buttons */}
              <div className="space-y-2">
                <h4 className="font-medium">Select a location to assign to all selected lessons:</h4>
                {locations.length === 0 ? (
                  <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription>
                      No locations have been created yet. Please create some locations first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-2">
                    {locations.map((location) => (
                      <Button
                        key={location.id}
                        variant="outline"
                        className="justify-start"
                        onClick={() => handleAssignLocation(location.id)}
                        disabled={loading}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        {location.name}
                        <span className="ml-auto text-sm text-muted-foreground">
                          ({selectedLessonIds.length} lessons)
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="mx-auto h-8 w-8 mb-2" />
                <p>Select lessons from the list to assign locations in bulk</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkLocationAssignment; 