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
    <div className="space-y-4 h-full flex flex-col">
      {/* Trash Zone - Always visible */}
      <Card 
        className={`border-2 border-dashed ${
          isDraggingOverTrash 
            ? 'border-red-500 bg-red-100' 
            : 'border-red-200 bg-red-50 hover:bg-red-100'
        } transition-colors flex-shrink-0`}
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

      {/* Unassigned Lessons */}
      <Card 
        className={`${
          isDraggingOverUnassigned 
            ? 'border-2 border-purple-400 bg-purple-50' 
            : ''
        } transition-colors flex-grow flex flex-col`}
      >
        <CardHeader className="flex-shrink-0">
          <CardTitle>Unassigned Lessons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 flex-grow flex flex-col">
          <Input
            type="search"
            placeholder="Search lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full flex-shrink-0"
          />
          
          <div 
            className="flex-grow overflow-y-auto space-y-2 pt-2"
            onDragOver={handleUnassignedDragOver}
            onDragLeave={handleUnassignedDragLeave}
            onDrop={handleUnassignedDrop}
          >
            {filteredUnassignedLessons.length === 0 ? (
              <div className="text-gray-500 text-center py-4">
                No unassigned lessons
              </div>
            ) : (
              filteredUnassignedLessons.map((lesson) => {
                const subject = getSubjectById(lesson.subject_id);
                const isDragging = draggedLesson?.id === lesson.id;
                
                return (
                  <div
                    key={lesson.id}
                    className={`p-3 rounded-md border cursor-move transition-all duration-200 ${
                      isDragging 
                        ? 'opacity-50 transform scale-95' 
                        : 'hover:shadow-md hover:border-gray-300'
                    }`}
                    style={{ 
                      backgroundColor: subject?.color ? `${subject.color}15` : '#f3f4f6',
                      borderColor: subject?.color || '#d1d5db'
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lesson)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handleLessonClick(e, lesson.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-gray-600" />
                          <span className="font-medium text-sm">{lesson.student_name}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            <span>{subject?.name || 'Unknown Subject'}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{lesson.duration} min</span>
                          </div>
                        </div>
                        
                        {lesson.start_date && (
                          <div className="text-xs text-gray-500 mt-1">
                            From: {format(new Date(lesson.start_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                      
                      {subject && (
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: subject.color }}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnassignedLessons;
