import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLessons } from '../../contexts/LessonsContext';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useDrag } from '../../contexts/DragContext';
import { Lesson } from '../../types';
import { Trash2 } from 'lucide-react';
import { startOfDay, isBefore, isEqual, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { format } from 'date-fns';
import { Clock, User, BookOpen, Calendar } from 'lucide-react';

interface UnassignedLessonsProps {
  lessons: Lesson[];
  onTrashDrop: (lessonId: string) => void;
  onUnassignDrop: (lessonId: string) => void;
  currentWeek: Date;
  editMode?: boolean;
  onLessonClick?: (lessonId: string) => void;
}

const UnassignedLessons = ({ 
  lessons,
  onTrashDrop,
  onUnassignDrop,
  currentWeek,
  editMode = false,
  onLessonClick
}: UnassignedLessonsProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { setDraggedLesson } = useDrag();
  const [isDraggingOverTrash, setIsDraggingOverTrash] = useState(false);
  const [isDraggingOverUnassigned, setIsDraggingOverUnassigned] = useState(false);
  const { draggedLesson } = useDrag();
  const { subjects } = useSubjects();
  
  // Filter for unassigned lessons (no teacher or no day/time)
  const unassignedLessons = lessons.filter(lesson => 
    !lesson.teacher_id || lesson.day === null || lesson.start_time === null
  );

  const getSubjectById = (subjectId: string) => {
    return subjects.find(subject => subject.id === subjectId);
  };
  
  // Convert duration in minutes to height in pixels (same as TimeGrid)
  const durationToHeight = (duration: number): number => duration * 1.6;
  
  // Helper function to lighten colors (same as in TimeGrid)
  const getLighterColor = (hexColor: string) => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Lighten by mixing with white (increase towards 255)
    const lighten = (color: number) => Math.min(255, Math.round(color + (255 - color) * 0.85));
    
    const newR = lighten(r);
    const newG = lighten(g);
    const newB = lighten(b);
    
    // Convert back to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };
  
  // Strictly filter to only show truly unassigned lessons
  // AND respect start dates - only show if start date is before or within current week
  const filteredUnassignedLessons = unassignedLessons.filter(lesson => {
    // If it has a start date, check if the current week is on or after that date
    if (lesson.start_date) {
      const startDate = startOfDay(new Date(lesson.start_date));
      
      // Get the week range properly using date-fns
      const weekStart = startOfWeek(new Date(currentWeek), { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(new Date(currentWeek), { weekStartsOn: 1 }); // Sunday
      
      // Check if the start date falls on or before the end of the current week
      return !isBefore(weekEnd, startDate);
    }
    
    // If no start date, always show the unassigned lesson
    return true;
  });
  
  // Apply search filter to the date-filtered lessons
  const searchFilteredLessons = filteredUnassignedLessons.filter(lesson => {
    if (!searchQuery.trim()) {
      return true; // If no search query, show all lessons
    }
    
    const query = searchQuery.toLowerCase().trim();
    const subject = getSubjectById(lesson.subject_id);
    
    // Search in student name, subject name, and duration
    const studentName = lesson.student_name.toLowerCase();
    const subjectName = subject?.name?.toLowerCase() || '';
    const duration = lesson.duration.toString();
    
    return studentName.includes(query) || 
           subjectName.includes(query) || 
           duration.includes(query);
  });
  
  const handleTrashDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDraggingOverTrash(true);
  };
  
  const handleTrashDragLeave = () => {
    setIsDraggingOverTrash(false);
  };
  
  const handleTrashDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const lessonId = e.dataTransfer.getData("lesson");
    onTrashDrop(lessonId);
    setIsDraggingOverTrash(false);
  };

  const handleUnassignedDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDraggingOverUnassigned(true);
  };
  
  const handleUnassignedDragLeave = () => {
    setIsDraggingOverUnassigned(false);
  };
  
  const handleUnassignedDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onUnassignDrop) {
      const lessonId = e.dataTransfer.getData("lesson");
      onUnassignDrop(lessonId);
    }
    setIsDraggingOverUnassigned(false);
  };

  const handleLessonClick = (e: React.MouseEvent, lessonId: string) => {
    if (editMode && onLessonClick) {
      e.preventDefault();
      e.stopPropagation();
      onLessonClick(lessonId);
    }
  };

  const handleDragStart = (e: React.DragEvent, lesson: Lesson) => {
    setDraggedLesson(lesson);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData("lesson", lesson.id);
  };

  const handleDragEnd = () => {
    setDraggedLesson(null);
  };

  return (
    <div className="h-screen flex flex-col sticky top-0">
      {/* Fixed Trash Zone - Always visible at top */}
      <div className="flex-shrink-0 pb-4">
        <Card 
          className={`border-2 border-dashed ${
            isDraggingOverTrash 
              ? 'border-red-500 bg-red-100' 
              : 'border-red-200 bg-red-50 hover:bg-red-100'
          } transition-colors`}
        >
          <CardContent 
            className="flex items-center justify-center py-6 px-12 cursor-pointer"
            onDragOver={handleTrashDragOver}
            onDragLeave={handleTrashDragLeave}
            onDrop={handleTrashDrop}
          >
            <div className="text-center text-red-500">
              <Trash2 className="mx-auto mb-2 h-6 w-6" />
              <div className="font-medium">Drop here to delete lesson</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Title Section */}
      <div className="flex-shrink-0 py-3 border-b border-gray-100">
        <h3 className="text-lg font-semibold">Unassigned Lessons</h3>
      </div>

      {/* Fixed Search Bar */}
      <div className="flex-shrink-0 py-3 border-b border-gray-100">
        <Input
          type="search"
          placeholder="Search lessons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Fixed Height Lessons Area - Scrollable within allocated space */}
      <div className="flex-1 min-h-0"> {/* min-h-0 allows flex child to shrink */}
        <Card 
          className={`h-full ${
            isDraggingOverUnassigned 
              ? 'border-2 border-purple-400 bg-purple-50' 
              : 'border border-gray-200'
          } transition-colors flex flex-col`}
        >
          <CardContent className="flex-grow p-0 h-full">
            <div 
              className="h-full overflow-y-auto space-y-2 p-4"
              onDragOver={handleUnassignedDragOver}
              onDragLeave={handleUnassignedDragLeave}
              onDrop={handleUnassignedDrop}
            >
              {searchFilteredLessons.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  {searchQuery.trim() ? (
                    <>
                      No lessons found for "{searchQuery}"
                      <div className="text-xs mt-1">
                        Try searching for student name,<br />
                        subject, or duration
                      </div>
                    </>
                  ) : (
                    "No unassigned lessons"
                  )}
                </div>
              ) : (
                searchFilteredLessons.map((lesson) => {
                  const subject = getSubjectById(lesson.subject_id);
                  const isDragging = draggedLesson?.id === lesson.id;
                  
                  return (
                    <div
                      key={lesson.id}
                      className={`rounded-lg cursor-move transition-all duration-200 flex items-center ${
                        isDragging 
                          ? 'opacity-50 transform scale-95' 
                          : 'hover:shadow-md'
                      }`}
                      style={{ 
                        backgroundColor: subject?.color ? getLighterColor(subject.color) : '#f3f4f6',
                        borderLeft: `4px solid ${subject?.color || '#9b87f5'}`,
                        height: `${durationToHeight(lesson.duration)}px`,
                        minHeight: '48px', // Ensure minimum height for readability
                        padding: '8px 12px', // Fixed padding instead of responsive p-3
                        maxWidth: '280px' // Limit width to keep UI balanced
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lesson)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleLessonClick(e, lesson.id)}
                    >
                      <div className="flex items-center justify-between w-full min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-gray-600 flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{lesson.student_name}</span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <div className="flex items-center gap-1 min-w-0">
                              <BookOpen className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{subject?.name || 'Unknown Subject'}</span>
                            </div>
                            
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Clock className="h-3 w-3" />
                              <span>{lesson.duration} min</span>
                            </div>
                          </div>
                          
                          {lesson.start_date && (
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              From: {format(new Date(lesson.start_date), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UnassignedLessons;
