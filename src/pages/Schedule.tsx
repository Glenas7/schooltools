import React, { useState, useEffect, Suspense, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useLessons } from '../contexts/LessonsContext';
import { useTeachers } from '../contexts/TeachersContext';
import ScheduleHeader from '../components/scheduler/ScheduleHeader';
import TeacherSelector from '../components/scheduler/TeacherSelector';
import TimeGrid from '../components/scheduler/TimeGrid';
import NewLessonForm, { SelectedTeacherContext } from '../components/scheduler/NewLessonForm';
import UnassignedLessons from '../components/scheduler/UnassignedLessons';
import { Edit, Move, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubjects } from '../contexts/SubjectsContext';
import { format, parseISO, addDays, isBefore, startOfDay, getDay, isWeekend, isSameDay, startOfWeek, endOfWeek, addWeeks, subWeeks, isAfter, addMinutes } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lesson } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useStudentNames } from '@/hooks/useStudentNames';
import { useSchool } from '../contexts/SchoolContext';

// Mock student names as a fallback, in case fetching fails
const MOCK_STUDENT_NAMES = [
  "Alice Smith", "Bob Johnson", "Charlie Williams", "David Brown", "Eva Jones",
  "Frank Miller", "Grace Davis", "Henry Wilson", "Iris Moore", "Jack Taylor"
];

// Helper function to normalize strings (remove accents) - can be moved to a utils file later
const normalizeString = (str: string): string => {
  return str
    .normalize('NFD')                    // Normalize to decomposed form
    .replace(/[\\u0300-\\u036f]/g, '');    // Remove combining diacritical marks
};

// Define the EditLessonModal component
interface EditLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string | null;
  onSuccess: () => void;
  weekDates: Date[];
  allLessons: Lesson[];
  selectedTeacherId: string | null;
}

const EditLessonModal = ({ 
  isOpen, 
  onClose, 
  lessonId, 
  onSuccess, 
  weekDates,
  allLessons,
}: EditLessonModalProps) => {
  const { subjects } = useSubjects();
  const { teachers } = useTeachers();
  const { updateLesson } = useLessons();
  
  // Define parseTime and formatTimeForSelect early so they can be used by other hooks/functions if needed
  const parseTime = (time: string | null): { hour: number, minute: number } => {
    if (!time) return { hour: 8, minute: 0 }; // Default if no time
    const [hours, minutes] = time.split(':').map(Number);
    return { hour: hours, minute: minutes };
  };

  const formatTimeForSelect = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [studentName, setStudentName] = useState('');
  const [duration, setDuration] = useState(30);
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null); // This will store time as "HH:mm"
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use our new hook to fetch and cache student names
  const { studentNames: allStudentNames, isLoading: isLoadingStudentNames } = useStudentNames();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState<number>(-1);
  const studentNameInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLUListElement>(null);
  
  const { hour: currentHour, minute: currentMinute } = parseTime(startTime);

  // Effect to handle closing autocomplete on outside click or Escape key
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        isAutocompleteOpen &&
        studentNameInputRef.current && 
        !studentNameInputRef.current.contains(event.target as Node) &&
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setIsAutocompleteOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAutocompleteOpen(false);
        setAutocompleteSelectedIndex(-1);
      }
    };

    if (isAutocompleteOpen) {
      document.addEventListener('mousedown', handleDocumentClick);
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAutocompleteOpen]);

  // Find the lesson from props and initialize form fields
  useEffect(() => {
    if (isOpen && lessonId && allLessons.length > 0) {
      const foundLesson = allLessons.find(l => l.id === lessonId);
      if (foundLesson) {
        setLesson(foundLesson);
        setStudentName(foundLesson.student_name);
        setDuration(foundLesson.duration);
        setSubjectId(foundLesson.subject_id);
        setTeacherId(foundLesson.teacher_id || "unassigned"); 
        setDayOfWeek(foundLesson.day);
        setStartTime(foundLesson.start_time);
        setStartDate(foundLesson.start_date ? format(parseISO(foundLesson.start_date), 'yyyy-MM-dd') : null);
        setEndDate(foundLesson.end_date ? format(parseISO(foundLesson.end_date), 'yyyy-MM-dd') : null);
      } else {
        console.warn(`EditLessonModal: Lesson with ID ${lessonId} not found.`);
      }
    }
    if (isOpen) {
      setIsAutocompleteOpen(false);
      setSuggestions([]);
      setAutocompleteSelectedIndex(-1);
    }
  }, [isOpen, lessonId, allLessons]);
  
  // Reset error message when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleStudentNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStudentName(value);
    
    if (value.length > 0 && allStudentNames.length > 0) {
      const normalizedValue = normalizeString(value.toLowerCase());
      const filtered = allStudentNames.filter(name => 
        normalizeString(name.toLowerCase()).includes(normalizedValue)
      );
      setSuggestions(filtered);
      if (filtered.length > 0) {
        setIsAutocompleteOpen(true);
        setAutocompleteSelectedIndex(0);
      } else {
        setIsAutocompleteOpen(false);
        setAutocompleteSelectedIndex(-1);
      }
    } else {
      setSuggestions([]);
      setIsAutocompleteOpen(false);
      setAutocompleteSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (name: string) => {
    setStudentName(name);
    setSuggestions([]);
    setIsAutocompleteOpen(false);
    setAutocompleteSelectedIndex(-1);
    studentNameInputRef.current?.focus();
  };

  // Add keyboard navigation for autocomplete
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isAutocompleteOpen) {
      return; 
    }

    if (!isAutocompleteOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocompleteSelectedIndex(prev => {
        const newIndex = prev < suggestions.length - 1 ? prev + 1 : 0;
        autocompleteRef.current?.querySelectorAll('li')[newIndex]?.scrollIntoView({ block: 'nearest' });
        return newIndex;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocompleteSelectedIndex(prev => {
        const newIndex = prev > 0 ? prev - 1 : suggestions.length - 1;
        autocompleteRef.current?.querySelectorAll('li')[newIndex]?.scrollIntoView({ block: 'nearest' });
        return newIndex;
      });
    } else if (e.key === 'Enter' && autocompleteSelectedIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[autocompleteSelectedIndex]);
    }
  };

  // Validation function to check for overlaps
  const validateNoOverlaps = (): boolean => {
    if (!teacherId || teacherId === "unassigned" || dayOfWeek === null || !startTime) return true;
    
    const lessonStartTimeDetails = parseTime(startTime);
    // Create a date object for comparison. Using a fixed date for time comparison logic.
    const lessonStartDateTime = new Date(2000, 0, 1, lessonStartTimeDetails.hour, lessonStartTimeDetails.minute);
    const lessonEndDateTime = addMinutes(lessonStartDateTime, duration);

    for (const existingLesson of allLessons) {
        if (existingLesson.id === lessonId) continue;
        if (existingLesson.teacher_id !== teacherId || existingLesson.day !== dayOfWeek || !existingLesson.start_time) continue;

        const existingStartTimeDetails = parseTime(existingLesson.start_time);
        const existingLessonStartDateTime = new Date(2000, 0, 1, existingStartTimeDetails.hour, existingStartTimeDetails.minute);
        const existingLessonEndDateTime = addMinutes(existingLessonStartDateTime, existingLesson.duration);
        
        if (lessonStartDateTime < existingLessonEndDateTime && lessonEndDateTime > existingLessonStartDateTime) {
            return false; // Overlap detected
        }
    }
    return true;
  };
  
  const handleHourChange = (value: string) => {
    const newHour = parseInt(value, 10);
    if (!isNaN(newHour)) {
      const newTime = formatTimeForSelect(newHour, currentMinute); // formatTimeForSelect is now defined
      setStartTime(newTime);
    }
  };

  const handleMinuteChange = (value: string) => {
    const newMinute = parseInt(value, 10);
    if (!isNaN(newMinute)) {
      const newTime = formatTimeForSelect(currentHour, newMinute); // formatTimeForSelect is now defined
      setStartTime(newTime);
    }
  };
  
  const handleSubmit = async () => {
    setError(null);
    if (!lessonId) {
      setError("Lesson ID is missing.");
      return;
    }
    if (!studentName.trim()) {
      setError('Student name is required.');
      return;
    }
    if (!subjectId) {
      setError('Subject is required.');
      return;
    }
    if (teacherId && teacherId !== "unassigned") {
      if (dayOfWeek === null) {
        setError('Day of the week is required for assigned lessons.');
        return;
      }
      if (!startTime) {
        setError('Start time is required for assigned lessons.');
        return;
      }
      if (!validateNoOverlaps()) {
        setError('This time slot overlaps with another lesson for this teacher.');
        return;
      }
    }
    if (startDate && endDate && isBefore(parseISO(endDate), parseISO(startDate))) {
      setError('End date must be after start date.');
      return;
    }

    try {
      setLoading(true);
      const lessonDataToUpdate: Partial<Lesson> & { id: string } = {
        id: lessonId,
        student_name: studentName.trim(),
        duration,
        subject_id: subjectId,
        teacher_id: teacherId === "unassigned" ? null : teacherId,
        day: teacherId === "unassigned" ? null : dayOfWeek,
        start_time: teacherId === "unassigned" ? null : startTime,
        start_date: startDate || null,
        end_date: endDate || null,
      };
      await updateLesson(lessonDataToUpdate);
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError('Failed to update lesson. Please try again.');
      console.error('Error updating lesson:', err);
    }
  };
  
  const availableSlots = useMemo(() => {
    if (!teacherId || teacherId === "unassigned" || dayOfWeek === null) return [];
    const slots: { time: string; available: boolean }[] = [];
    const dayDate = weekDates[dayOfWeek];
    if (!dayDate) return [];

    for (let h = 7; h < 21; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotStartTimeStr = formatTimeForSelect(h, m); // Use formatTimeForSelect
        const slotStartTimeDetails = parseTime(slotStartTimeStr);
        const slotStartDateTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), slotStartTimeDetails.hour, slotStartTimeDetails.minute);
        const slotEndDateTime = addMinutes(slotStartDateTime, duration);
        let isAvailable = true;

        for (const l of allLessons) {
          if (l.id === lessonId) continue;
          if (l.teacher_id === teacherId && l.day === dayOfWeek && l.start_time) {
            const existingLessonStartDetails = parseTime(l.start_time);
            const existingLessonStartDateTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), existingLessonStartDetails.hour, existingLessonStartDetails.minute);
            const existingLessonEndDateTime = addMinutes(existingLessonStartDateTime, l.duration);

            if (slotStartDateTime < existingLessonEndDateTime && slotEndDateTime > existingLessonStartDateTime) {
              isAvailable = false;
              break;
            }
          }
        }
        slots.push({ time: slotStartTimeStr, available: isAvailable });
      }
    }
    return slots;
  }, [teacherId, dayOfWeek, duration, allLessons, weekDates, lessonId, parseTime, formatTimeForSelect]); // Added parseTime and formatTimeForSelect to deps
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        setIsAutocompleteOpen(false);
        setSuggestions([]);
      }
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lesson Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2 relative">
            <Label htmlFor="edit-student-name">Student Name</Label>
            <Input
              id="edit-student-name"
              ref={studentNameInputRef}
              value={studentName}
              onChange={handleStudentNameChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Enter student name"
              autoComplete="off"
              onFocus={() => {
                if (studentName.length > 0 && suggestions.length > 0) {
                  setIsAutocompleteOpen(true);
                }
              }}
            />
            {isAutocompleteOpen && suggestions.length > 0 && (
              <ul 
                ref={autocompleteRef}
                className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto dark:bg-gray-950 dark:border-gray-800"
              >
                {suggestions.map((name, index) => (
                  <li
                    key={index}
                    className={`px-3 py-2 text-sm cursor-pointer ${
                      autocompleteSelectedIndex === index 
                        ? 'bg-blue-100 dark:bg-blue-900' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    onMouseEnter={() => setAutocompleteSelectedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault(); 
                      handleSuggestionClick(name);
                    }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Duration (minutes)</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="edit-duration"
                  type="number"
                  min={15}
                  max={120}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(15, Math.min(120, parseInt(e.target.value) || 30)))}
                  className="w-20"
                />
                 <div className="flex space-x-1">
                  {[30, 45, 60, 90].map((mins) => (
                    <Button
                      key={mins}
                      variant={duration === mins ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDuration(mins)}
                      className="px-2 py-1 text-xs"
                    >
                      {mins}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="edit-subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-teacher">Teacher</Label>
            <Select value={teacherId} onValueChange={(value) => {
                setTeacherId(value);
                if (value === "unassigned") {
                    setDayOfWeek(null);
                    setStartTime(null);
                }
            }}>
              <SelectTrigger id="edit-teacher">
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {teacherId && teacherId !== "unassigned" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-dayOfWeek">Day of the Week</Label>
                <Select 
                    value={dayOfWeek !== null ? dayOfWeek.toString() : ""} 
                    onValueChange={(value) => setDayOfWeek(value ? parseInt(value) : null)}
                    disabled={!teacherId || teacherId === "unassigned"}
                >
                  <SelectTrigger id="edit-dayOfWeek">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {weekDates.map((date, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {format(date, 'EEEE (MMM d)')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-startTimeHour">Start Time</Label>
                <div className="flex items-center space-x-2">
                  <Select 
                    value={currentHour.toString()} 
                    onValueChange={handleHourChange}
                    disabled={!teacherId || teacherId === "unassigned" || dayOfWeek === null}
                  >
                    <SelectTrigger id="edit-startTimeHour" className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 15 }, (_, i) => 7 + i).map(hour => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {hour % 12 || 12} {hour < 12 || hour === 24 ? 'AM' : 'PM'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>:</span>
                  <Select 
                    value={currentMinute.toString().padStart(2, '0')} 
                    onValueChange={handleMinuteChange}
                    disabled={!teacherId || teacherId === "unassigned" || dayOfWeek === null}
                  >
                    <SelectTrigger id="edit-startTimeMinute" className="w-[60px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(min => (
                        <SelectItem key={min} value={min.toString()}>
                          {min.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {teacherId && teacherId !== "unassigned" && dayOfWeek !== null && startTime && !validateNoOverlaps() && (
                    <p className="text-xs text-red-500">Time conflict with another lesson.</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-startDate">Start Date (Optional)</Label>
              <Input
                id="edit-startDate"
                type="date"
                value={startDate || ''}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endDate">End Date (Optional)</Label>
              <Input
                id="edit-endDate"
                type="date"
                value={endDate || ''}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
          </div>

        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            onClose();
            setIsAutocompleteOpen(false);
            setSuggestions([]);
          }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface CalculatedTimeRange {
  startHour: number;
  startMinute: 0 | 30;
  gridVisualEndHour: number;
  gridVisualEndMinute: 0 | 30;
}

const MOBILE_BREAKPOINT = 768;

// Helper function to find the best day to display in a week
const findBestDayToShow = (lessons: Lesson[], userId: string, weekDates: Date[], currentDay = null) => {
  console.log("Finding best day to show for user", userId, "with", lessons.length, "lessons");
  
  // Start with fallback day
  const bestDayIndex = currentDay !== null ? currentDay : 0;
  
  // No lessons case - return fallback
  if (lessons.length === 0) {
    console.log("No lessons found, using fallback day:", bestDayIndex);
    return bestDayIndex;
  }
  
  // Filter lessons for this teacher
  const teacherLessons = lessons.filter(l => l.teacher_id === userId);
  
  if (teacherLessons.length === 0) {
    console.log("No lessons for this teacher, using fallback day:", bestDayIndex);
    return bestDayIndex;
  }

  // 1. If currentDay is provided, check if it has lessons
  if (currentDay !== null && currentDay >= 0 && currentDay < 5) {
    const hasLessonsOnCurrentDay = teacherLessons.some(l => l.day === currentDay);
    if (hasLessonsOnCurrentDay) {
      console.log("Current day", currentDay, "has lessons, using it");
      return currentDay;
    }
  }
  
  // 2. Try to find closest future day with lessons (starting from currentDay or 0)
  const startDay = (currentDay !== null && currentDay >= 0 && currentDay < 5) ? currentDay : 0;
  for (let i = startDay; i < 5; i++) {
    const hasLessons = teacherLessons.some(l => l.day === i);
    if (hasLessons) {
      console.log("Found future day with lessons:", i);
      return i;
    }
  }
  
  // 3. Try to find closest past day with lessons (if currentDay provided)
  if (currentDay !== null && currentDay > 0) {
    for (let i = currentDay - 1; i >= 0; i--) {
      const hasLessons = teacherLessons.some(l => l.day === i);
      if (hasLessons) {
        console.log("Found past day with lessons:", i);
        return i;
      }
    }
  }
  
  // 4. If we get here and no day found, look through all days from the beginning
  if (currentDay !== null && currentDay > 0) {
    for (let i = 0; i < currentDay; i++) {
      const hasLessons = teacherLessons.some(l => l.day === i);
      if (hasLessons) {
        console.log("Found day with lessons from beginning:", i);
        return i;
      }
    }
  }
  
  // 5. Look for any day with lessons (this is a final sweep)
  for (let i = 0; i < 5; i++) {
    const hasLessons = teacherLessons.some(l => l.day === i);
    if (hasLessons) {
      console.log("Found any day with lessons:", i);
      return i;
    }
  }
  
  // If we got here, teacher has no lessons this week
  console.log("No days with lessons found, using fallback day:", bestDayIndex);
  return bestDayIndex;
};

// Add this function near the top level to check future weeks
const checkFutureLessons = async (
  userId, 
  currentWeekDate, 
  fetchLessons, 
  setCurrentWeek, 
  getWeekDates,
  setMobileSelectedDayIndex
) => {
  console.log("Checking for lessons in future weeks for teacher:", userId);
  
  const today = startOfDay(new Date()); // Use startOfDay for accurate date comparison
  console.log(`Today (startOfDay) is ${today.toISOString().split('T')[0]}`);
  
  // Get the actual dates for the current viewing week
  const currentViewingWeekDates = getWeekDates(); 
  console.log(`Current viewing week dates:`, currentViewingWeekDates.map(d => d.toISOString().split('T')[0]));

  // Check the current week first
  const currentWeekLessons = await fetchLessons(userId, currentWeekDate, true);
  
  const teacherLessonsThisWeek = currentWeekLessons.filter(l => l.teacher_id === userId && l.day !== null && l.day >= 0 && l.day < currentViewingWeekDates.length);
  console.log(`Teacher has ${teacherLessonsThisWeek.length} lessons this week:`, 
              teacherLessonsThisWeek.map(l => `Day index ${l.day} (${currentViewingWeekDates[l.day]?.toISOString().split('T')[0]}) at ${l.start_time}`));
  
  // Check if teacher has any FUTURE lessons in the current week
  const futureLessonsInCurrentWeek = teacherLessonsThisWeek.filter(l => {
    const lessonDate = currentViewingWeekDates[l.day]; // Get the actual date of the lesson
    return isAfter(lessonDate, today); // Check if the lesson's date is after today
  });
  
  console.log(`Teacher has ${futureLessonsInCurrentWeek.length} FUTURE lessons this week (after ${today.toISOString().split('T')[0]}):`, 
              futureLessonsInCurrentWeek.map(l => `Day index ${l.day} (${currentViewingWeekDates[l.day]?.toISOString().split('T')[0]}) at ${l.start_time}`));
  
  if (futureLessonsInCurrentWeek.length > 0) {
    console.log("Teacher has FUTURE lessons in current week");
    
    futureLessonsInCurrentWeek.sort((a, b) => a.day - b.day);
    
    const nextLessonDayIndex = futureLessonsInCurrentWeek[0].day;
    console.log(`Setting view to next lesson day index: ${nextLessonDayIndex}`);
    setMobileSelectedDayIndex(nextLessonDayIndex);
    return true; // Found a future lesson in the current week
  }
  
  // No future lessons this week, proceed to check next weeks
  console.log("No future lessons found in the current viewing week. Checking subsequent weeks.");

  // Check next week
  const nextWeekDate = addWeeks(currentWeekDate, 1);
  const nextWeekLessons = await fetchLessons(userId, nextWeekDate, true);
  
  const teacherLessonsNextWeek = nextWeekLessons.filter(l => l.teacher_id === userId && l.day !== null && l.day >= 0 && l.day < currentViewingWeekDates.length);
  console.log(`Teacher has ${teacherLessonsNextWeek.length} lessons next week:`, 
              teacherLessonsNextWeek.map(l => `Day index ${l.day} (${currentViewingWeekDates[l.day]?.toISOString().split('T')[0]}) at ${l.start_time}`));
  
  if (teacherLessonsNextWeek.length > 0) {
    console.log("Found lessons in next week - navigating to next week");
    
    teacherLessonsNextWeek.sort((a, b) => a.day - b.day);
    
    const firstLessonDay = teacherLessonsNextWeek[0].day;
    console.log(`First lesson in next week is on day ${firstLessonDay}`);
    
    // Navigate to next week and select the day
    console.log(`Setting currentWeek to ${nextWeekDate.toISOString().split('T')[0]}`);
    setCurrentWeek(nextWeekDate);
    console.log(`Setting mobileSelectedDayIndex to ${firstLessonDay}`);
    setMobileSelectedDayIndex(firstLessonDay);
    return true;
  }
  
  // Check two weeks ahead if needed
  const twoWeeksDate = addWeeks(currentWeekDate, 2);
  const twoWeeksLessons = await fetchLessons(userId, twoWeeksDate, true);
  
  const teacherLessonsTwoWeeksAhead = twoWeeksLessons.filter(l => l.teacher_id === userId && l.day !== null && l.day >= 0 && l.day < currentViewingWeekDates.length);
  console.log(`Teacher has ${teacherLessonsTwoWeeksAhead.length} lessons two weeks ahead:`, 
              teacherLessonsTwoWeeksAhead.map(l => `Day index ${l.day} (${currentViewingWeekDates[l.day]?.toISOString().split('T')[0]}) at ${l.start_time}`));
  
  if (teacherLessonsTwoWeeksAhead.length > 0) {
    console.log("Found lessons two weeks ahead - navigating there");
    
    teacherLessonsTwoWeeksAhead.sort((a, b) => a.day - b.day);
    
    const firstLessonDay = teacherLessonsTwoWeeksAhead[0].day;
    console.log(`First lesson in two weeks is on day ${firstLessonDay}`);
    
    // Navigate to that week and select the day
    console.log(`Setting currentWeek to ${twoWeeksDate.toISOString().split('T')[0]}`);
    setCurrentWeek(twoWeeksDate);
    console.log(`Setting mobileSelectedDayIndex to ${firstLessonDay}`);
    setMobileSelectedDayIndex(firstLessonDay);
    return true;
  }
  
  // No lessons found in the next two weeks
  console.log("No lessons found in next two weeks");
  return false;
};

// Add this utility function to find the best day in a specific week
const findBestDayInWeek = (lessons: Lesson[], teacherId: string) => {
  // Filter for teacher's lessons only
  const teacherLessons = lessons.filter(l => l.teacher_id === teacherId && l.day !== null);
  
  if (teacherLessons.length === 0) {
    console.log("No lessons found for teacher in target week, returning default (Monday)");
    return 0; // Default to Monday
  }
  
  // Sort by day to get earliest lesson
  teacherLessons.sort((a, b) => a.day - b.day);
  const firstLessonDay = teacherLessons[0].day;
  
  console.log(`First lesson day in target week is day ${firstLessonDay}`);
  return firstLessonDay;
};

const Schedule = () => {
  const { user } = useAuth();
  const { isSchoolAdmin } = useSchool();
  const { lessons, currentWeek, nextWeek, prevWeek, getWeekDates, setCurrentWeek, assignLesson, unassignLesson, rescheduleLesson, deleteLesson, fetchLessons } = useLessons();
  const { teachers, loading: teachersLoading } = useTeachers();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [mobileSelectedDayIndex, setMobileSelectedDayIndex] = useState(0);
  
  const initialDaySelectionDone = useRef(false);
  const lastSelectedWeek = useRef(currentWeek);
  const initialFutureCheckDone = useRef(false);
  const weekNavigationInProgress = useRef(false);

  // Effect for screen resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Effect for setting selectedTeacherId
  useEffect(() => {
    if (teachersLoading) return;
    if (teachers.length > 0) {
      const currentTeacherIsValid = teachers.some(t => t.id === selectedTeacherId);
      if (!selectedTeacherId || !currentTeacherIsValid) {
        let newTeacherIdToSet = '';
        if (user && teachers.some(t => t.id === user.id)) {
          newTeacherIdToSet = user.id;
        } else {
    const firstActiveTeacher = teachers.find(t => t.active);
          if (firstActiveTeacher) newTeacherIdToSet = firstActiveTeacher.id;
          else if (teachers.length > 0) newTeacherIdToSet = teachers[0].id;
        }
        if (newTeacherIdToSet && selectedTeacherId !== newTeacherIdToSet) {
          setSelectedTeacherId(newTeacherIdToSet);
        }
      }
    } else {
      if (selectedTeacherId !== '') setSelectedTeacherId('');
    }
  }, [teachers, user, teachersLoading, selectedTeacherId]);
  
  // Effect for fetching lessons
  useEffect(() => {
    if (selectedTeacherId) fetchLessons(selectedTeacherId, currentWeek);
    else if (user && user.id) {
      fetchLessons(user.id, currentWeek);
    }
  }, [selectedTeacherId, currentWeek, fetchLessons, user]);
  
  // New effect to check future weeks on initial load for teachers
  useEffect(() => {
    if (user && user.id && !initialFutureCheckDone.current && isMobileView) {
      console.log("Performing initial future lessons check for teacher");
      const checkFuture = async () => {
        const navigated = await checkFutureLessons(
          user.id,
          currentWeek,
          fetchLessons,
          setCurrentWeek,
          getWeekDates,
          setMobileSelectedDayIndex
        );
        initialFutureCheckDone.current = true;
        if (navigated) {
          initialDaySelectionDone.current = true;
        }
      };
      checkFuture();
    }
  }, [user, currentWeek, isMobileView, fetchLessons, getWeekDates, setCurrentWeek, setMobileSelectedDayIndex]);
  
  const weekDates = getWeekDates();
  
  // MODIFIED Effect to determine default mobileSelectedDayIndex for teachers
  useEffect(() => {
    console.log("useEffect (Default Day Selector): Running. currentWeek:", currentWeek.toISOString().split('T')[0], "weekNavInProgress:", weekNavigationInProgress.current, "initialDaySelectionDone:", initialDaySelectionDone.current);

    const weekHasChanged = lastSelectedWeek.current?.getTime() !== currentWeek.getTime();

    if (weekHasChanged) {
      console.log("useEffect (Default Day Selector): Week has changed.");
      lastSelectedWeek.current = currentWeek;
      if (!weekNavigationInProgress.current) {
        console.log("useEffect (Default Day Selector): Resetting initialDaySelectionDone = false (not a button nav).");
        initialDaySelectionDone.current = false;
      } else {
        console.log("useEffect (Default Day Selector): Week changed during button nav, initialDaySelectionDone not reset by this effect.");
      }
    }

    if (weekNavigationInProgress.current) {
      console.log("useEffect (Default Day Selector): Bailing out, week navigation (prev/next button) in progress.");
      return;
    }

    if (user && user.id && weekDates.length === 5 && !initialDaySelectionDone.current) {
      console.log("useEffect (Default Day Selector): Conditions met to set default day.");
      const today = new Date();
      let currentDayInViewIndex = -1;
      if (weekDates && weekDates.length === 5) { // Ensure weekDates is populated
        for (let i = 0; i < weekDates.length; i++) {
          if (isSameDay(today, weekDates[i])) {
            currentDayInViewIndex = i;
            break;
          }
        }
        // If today is a weekend, but we are viewing "this" week, default to Monday
        if (isWeekend(today) && currentDayInViewIndex === -1 && weekDates[0] && isSameDay(startOfWeek(today, { weekStartsOn: 1 }), weekDates[0])) {
          currentDayInViewIndex = 0;
        }
      }

      console.log("useEffect (Default Day Selector): Finding best day. Lessons:", lessons.length, "User:", user.id, "DayInView:", currentDayInViewIndex);
      const dayToSelect = findBestDayToShow(
        lessons,
        user.id,
        weekDates,
        (currentDayInViewIndex >= 0 && currentDayInViewIndex < 5) ? currentDayInViewIndex : null
      );
      setMobileSelectedDayIndex(dayToSelect);
      initialDaySelectionDone.current = true;
      console.log(`useEffect (Default Day Selector): Set mobileSelectedDayIndex to ${dayToSelect}. initialDaySelectionDone=true.`);
    } else {
      if (initialDaySelectionDone.current) console.log("useEffect (Default Day Selector): Bypassed, initialDaySelectionDone is true.");
      // Other conditions for bypassing are logged above or implicitly by not meeting the if condition
    }
  }, [currentWeek, user, weekDates, lessons, setMobileSelectedDayIndex]);
  
  const calculateTimeRange = (): CalculatedTimeRange => {
    const defaultAdminRange: CalculatedTimeRange = { startHour: 8, startMinute: 0, gridVisualEndHour: 19, gridVisualEndMinute: 0 };
    const defaultTeacherNoLessonsRange: CalculatedTimeRange = { startHour: 9, startMinute: 0, gridVisualEndHour: 18, gridVisualEndMinute: 0 };
    
    // For school admins and superadmins, always use the fixed admin range (8:00-19:00)
    if (isSchoolAdmin) {
      return defaultAdminRange;
    }
    
    // For teachers, use the dynamic range based on their lessons
    if (!selectedTeacherId) {
      return defaultAdminRange;
    }
    const teacherLessons = lessons.filter(lesson => 
      lesson.teacher_id === selectedTeacherId && 
      lesson.day !== null && 
      lesson.start_time !== null
    );
    if (teacherLessons.length === 0) {
      console.log("Schedule.calculateTimeRange: No lessons for teacher, using default 9:00-18:00 range.");
      return defaultTeacherNoLessonsRange; 
    }
    let earliestLessonStartHour = 24;
    let earliestLessonStartMinute: 0 | 30 = 0;
    let maxLessonActualEndHour = 0;
    let maxLessonActualEndMinute = 0;
    teacherLessons.forEach(lesson => {
      if (lesson.start_time) {
        const [lessonStartH, lessonStartM] = lesson.start_time.split(':').map(Number);
        if (lessonStartH < earliestLessonStartHour) {
            earliestLessonStartHour = lessonStartH;
            earliestLessonStartMinute = lessonStartM === 30 ? 30 : 0;
        } else if (lessonStartH === earliestLessonStartHour) {
            earliestLessonStartMinute = Math.min(earliestLessonStartMinute, lessonStartM === 30 ? 30 : 0) as (0 | 30);
        }
        const lessonStartTotalMinutes = lessonStartH * 60 + lessonStartM;
        const lessonEndTotalMinutes = lessonStartTotalMinutes + lesson.duration;
        const currentLessonActualEndHour = Math.floor(lessonEndTotalMinutes / 60);
        const currentLessonActualEndMinute = lessonEndTotalMinutes % 60;
        if (currentLessonActualEndHour > maxLessonActualEndHour) {
            maxLessonActualEndHour = currentLessonActualEndHour;
            maxLessonActualEndMinute = currentLessonActualEndMinute;
        } else if (currentLessonActualEndHour === maxLessonActualEndHour) {
            maxLessonActualEndMinute = Math.max(maxLessonActualEndMinute, currentLessonActualEndMinute);
        }
      }
    });
    let finalGridStartHour = earliestLessonStartHour;
    let finalGridStartMinute = earliestLessonStartMinute;
    let finalGridVisualEndHour: number;
    let finalGridVisualEndMinute: 0 | 30;
    if (maxLessonActualEndMinute === 0) { 
        finalGridVisualEndHour = maxLessonActualEndHour;
        finalGridVisualEndMinute = 0;
    } else if (maxLessonActualEndMinute > 0 && maxLessonActualEndMinute <= 30) { 
        finalGridVisualEndHour = maxLessonActualEndHour;
        finalGridVisualEndMinute = 30;
    } else { 
        finalGridVisualEndHour = maxLessonActualEndHour + 1;
        finalGridVisualEndMinute = 0;
    }
    const SYSTEM_MIN_START_HOUR = 7;
    const SYSTEM_MAX_VISUAL_END_HOUR = 20;
    if (finalGridStartHour < SYSTEM_MIN_START_HOUR) {
        finalGridStartHour = SYSTEM_MIN_START_HOUR;
        finalGridStartMinute = 0;
    }
    if (finalGridVisualEndHour > SYSTEM_MAX_VISUAL_END_HOUR) {
        finalGridVisualEndHour = SYSTEM_MAX_VISUAL_END_HOUR;
        finalGridVisualEndMinute = 0; 
    } else if (finalGridVisualEndHour === SYSTEM_MAX_VISUAL_END_HOUR && finalGridVisualEndMinute > 0) {
        finalGridVisualEndMinute = 0; 
    }
    const startTotalMinutesValue = finalGridStartHour * 60 + finalGridStartMinute;
    const endTotalMinutesValue = finalGridVisualEndHour * 60 + finalGridVisualEndMinute;
    if (endTotalMinutesValue <= startTotalMinutesValue) {
        console.warn(`Schedule.calculateTimeRange: Calculated end (${finalGridVisualEndHour}:${finalGridVisualEndMinute}) is not after start (${finalGridStartHour}:${finalGridStartMinute}). Using default.`);
        return defaultTeacherNoLessonsRange;
    }
    console.log(`Schedule.calculateTimeRange: Raw: earliestStart=${earliestLessonStartHour}:${earliestLessonStartMinute}, maxLessonEnd=${maxLessonActualEndHour}:${String(maxLessonActualEndMinute).padStart(2,'0')}`);
    console.log(`Schedule.calculateTimeRange: Final: startHour=${finalGridStartHour}, startMinute=${finalGridStartMinute}, visualEndHour=${finalGridVisualEndHour}, visualEndMinute=${finalGridVisualEndMinute}`);
    return { 
        startHour: finalGridStartHour, 
        startMinute: finalGridStartMinute,
        gridVisualEndHour: finalGridVisualEndHour, 
        gridVisualEndMinute: finalGridVisualEndMinute 
    };
  };

  const selectedTeacherName = teachers.find(t => t.id === selectedTeacherId)?.name || '';
  const timeRange = calculateTimeRange();
  
  // Mobile Day Navigation Handlers
  const handlePrevDayMobile = useCallback(() => {
    const newIndex = Math.max(0, mobileSelectedDayIndex - 1);
    setMobileSelectedDayIndex(newIndex);
    initialDaySelectionDone.current = true; 
  }, [mobileSelectedDayIndex, setMobileSelectedDayIndex]);
  
  const handleNextDayMobile = useCallback(() => {
    const newIndex = Math.min(4, mobileSelectedDayIndex + 1);
    setMobileSelectedDayIndex(newIndex);
    initialDaySelectionDone.current = true;
  }, [mobileSelectedDayIndex, setMobileSelectedDayIndex]);

  // MODIFIED Week Navigation Handlers
  const handlePrevWeek = useCallback(async () => {
    if (weekNavigationInProgress.current) return;
    weekNavigationInProgress.current = true;
    console.log("handlePrevWeek: Started. Current context week:", currentWeek.toISOString().split('T')[0]);

    const targetWeekDateForLessons = subWeeks(currentWeek, 1);
    console.log("handlePrevWeek: Target week for lessons:", targetWeekDateForLessons.toISOString().split('T')[0]);
    
    prevWeek(); // Trigger context change

    if (user && user.id && isMobileView) {
      console.log("handlePrevWeek: Fetching lessons for the calculated target week.");
      const lessonsForTargetWeek = await fetchLessons(user.id, targetWeekDateForLessons, true);
      const bestDayIndex = findBestDayInWeek(lessonsForTargetWeek, user.id);
      console.log(`handlePrevWeek: Setting mobileSelectedDayIndex to ${bestDayIndex}.`);
      setMobileSelectedDayIndex(bestDayIndex);
      initialDaySelectionDone.current = true; 
    }
    weekNavigationInProgress.current = false;
    console.log("handlePrevWeek: Finished.");
  }, [currentWeek, prevWeek, user, isMobileView, fetchLessons, setMobileSelectedDayIndex]);

  const handleNextWeek = useCallback(async () => {
    if (weekNavigationInProgress.current) return;
    weekNavigationInProgress.current = true;
    console.log("handleNextWeek: Started. Current context week:", currentWeek.toISOString().split('T')[0]);

    const targetWeekDateForLessons = addWeeks(currentWeek, 1);
    console.log("handleNextWeek: Target week for lessons:", targetWeekDateForLessons.toISOString().split('T')[0]);

    nextWeek(); // Trigger context change

    if (user && user.id && isMobileView) {
      console.log("handleNextWeek: Fetching lessons for the calculated target week.");
      const lessonsForTargetWeek = await fetchLessons(user.id, targetWeekDateForLessons, true);
      const bestDayIndex = findBestDayInWeek(lessonsForTargetWeek, user.id);
      console.log(`handleNextWeek: Setting mobileSelectedDayIndex to ${bestDayIndex}.`);
      setMobileSelectedDayIndex(bestDayIndex);
      initialDaySelectionDone.current = true;
    }
    weekNavigationInProgress.current = false;
    console.log("handleNextWeek: Finished.");
  }, [currentWeek, nextWeek, user, isMobileView, fetchLessons, setMobileSelectedDayIndex]);
  
  // handleSetCurrentWeek
  const handleSetCurrentWeek = () => {
    console.log("handleSetCurrentWeek: Navigating to current week.");
    // weekNavigationInProgress should be false here, so the default useEffect will take over.
    setCurrentWeek(new Date());
    if (isMobileView && !user) {
      initialDaySelectionDone.current = false; // Allow the default useEffect to determine the best day
    }
  };
  
  const handleLessonDrop = (lessonId: string, day: number, time: string, slotDate: Date) => {
    const lesson = lessons.find(l => l.id === lessonId);
    
    if (!lesson) return;
    
    // Ensure we have a valid teacher ID before proceeding
    const currentTeacherId = selectedTeacherId || null;
    
    if (lesson.teacher_id === null && lesson.day === null && lesson.start_time === null) {
      // Assign an unassigned lesson
      if (currentTeacherId) {
        assignLesson(lessonId, currentTeacherId, day, time, slotDate);
      } else {
        console.error("Cannot assign lesson: No teacher selected");
      }
    } 
    else if (lesson.teacher_id) {
      // Get the actual date this lesson is dragged from
      const originalDate = lesson.day !== null ? weekDates[lesson.day] : currentWeek;
      
      // Reschedule an existing lesson using the specific date it was dragged from
      // Ensure we're always passing a valid teacher ID
      rescheduleLesson(
        lessonId, 
        originalDate, // originalSlotDate - use the actual date of the lesson, not just Monday
        currentTeacherId, // Use the stored value to prevent undefined
        day, 
        time, 
        slotDate // targetSlotDate - the date where it's being dropped
      );
    }
  };
  
  const handleLessonUnassign = (lessonId: string) => {
    const lessonToUnassign = lessons.find(l => l.id === lessonId);

    // If the lesson is not found, or is already unassigned, do nothing.
    if (!lessonToUnassign || lessonToUnassign.teacher_id === null) {
      return;
    }

    // Get the actual date for this lesson's day
    const originalDate = lessonToUnassign.day !== null ? weekDates[lessonToUnassign.day] : currentWeek;
    
    // Use the actual date when unassigning
    unassignLesson(lessonId, originalDate);
  };
  
  const handleLessonDelete = (lessonId: string) => {
    const lessonToDelete = lessons.find(l => l.id === lessonId);
    
    if (!lessonToDelete) {
      return;
    }
    
    // Get the actual date for this lesson's day
    let originalDate;
    
    if (lessonToDelete.day !== null) {
      // Assigned lessons: use the date from the weekDates array
      originalDate = weekDates[lessonToDelete.day];
    } else if (lessonToDelete.start_date) {
      // Unassigned lessons with start date: use that date
      originalDate = new Date(lessonToDelete.start_date);
    } else {
      // Fallback to current week
      originalDate = currentWeek;
    }
    
    // Use the actual date when deleting
    deleteLesson(lessonId, originalDate);
  };
  
  const handleLessonClick = (lessonId: string) => {
    if (editMode && user) {
      setSelectedLessonId(lessonId);
      setIsEditModalOpen(true);
    }
  };
  
  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedLessonId(null);
    if (selectedTeacherId) {
      fetchLessons(selectedTeacherId, currentWeek);
    } else {
      fetchLessons(null, currentWeek);
    }
  };
  
  return (
    <div>
      <div className="mb-4">
        {/* Title section - Always visible */}
        <div className="mb-2">
          {!user && selectedTeacherName ? (
            <h1 className="text-2xl font-bold">Weekly schedule for {selectedTeacherName}</h1>
          ) : (
            <h1 className="text-2xl font-bold">Weekly Schedule</h1>
          )}
          {(!isMobileView || user) && (
            <p className="text-gray-500">
              {format(weekDates[0], 'MMMM d')} - {format(weekDates[4], 'MMMM d, yyyy')}
            </p>
          )}
        </div>
        
        {/* Week navigation buttons - Full width on mobile, side-by-side on desktop */}
        <div className={`${isMobileView ? 'flex flex-col space-y-2' : 'flex justify-end'} mb-2`}>
          <div className={`flex ${isMobileView ? 'w-full justify-between' : 'space-x-2'}`}>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevWeek}
              className={isMobileView ? 'flex-1' : ''}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous Week
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSetCurrentWeek}
              className={isMobileView ? 'flex-1 mx-1' : ''}
            >
              Current Week
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextWeek}
              className={isMobileView ? 'flex-1' : ''}
            >
              Next Week
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
      
      {user && (
        <div className="flex justify-between items-center mb-2">
        <TeacherSelector 
          selectedTeacherId={selectedTeacherId} 
            onTeacherChange={setSelectedTeacherId} 
          />
          
          <div className="flex space-x-1 rounded-md overflow-hidden">
            <Button 
              variant={!editMode ? "default" : "outline"} 
              size="sm"
              onClick={() => setEditMode(false)}
              className="rounded-r-none"
            >
              <Move className="h-4 w-4 mr-2" />
              Drag Mode
            </Button>
            <Button 
              variant={editMode ? "default" : "outline"} 
              size="sm"
              onClick={() => setEditMode(true)}
              className="rounded-l-none"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Mode
            </Button>
          </div>
        </div>
      )}
      
      {isMobileView && !user && weekDates.length === 5 && (
        <div className="flex items-center justify-between mb-2 p-2 border rounded-md">
          {/* Left chevron - invisible when disabled but keeps space */}
          <div className="w-10 h-10 flex items-center justify-center">
            {mobileSelectedDayIndex > 0 && (
              <Button variant="ghost" size="icon" onClick={handlePrevDayMobile}>
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
          </div>
          
          <div className="text-center">
            <div className="font-medium text-lg">{format(weekDates[mobileSelectedDayIndex], 'EEEE')}</div>
            <div className="text-sm text-gray-600">{format(weekDates[mobileSelectedDayIndex], 'MMMM d, yyyy')}</div>
          </div>
          
          {/* Right chevron - invisible when disabled but keeps space */}
          <div className="w-10 h-10 flex items-center justify-center">
            {mobileSelectedDayIndex < 4 && (
              <Button variant="ghost" size="icon" onClick={handleNextDayMobile}>
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>
        </div>
      )}
      
      {user && (
        <SelectedTeacherContext.Provider value={selectedTeacherId}>
          <NewLessonForm />
        </SelectedTeacherContext.Provider>
      )}
      
      <div className="flex gap-6">
        <div className="flex-1">
          <TimeGrid 
            weekDates={weekDates}
            lessons={lessons}
            selectedTeacherId={selectedTeacherId}
            onLessonDrop={handleLessonDrop}
            onLessonClick={handleLessonClick}
            isAdmin={!!user}
            editMode={editMode}
            startHour={timeRange.startHour}
            startMinute={timeRange.startMinute}
            gridVisualEndHour={timeRange.gridVisualEndHour}
            gridVisualEndMinute={timeRange.gridVisualEndMinute}
            isMobileView={isMobileView}
            mobileSelectedDayIndex={mobileSelectedDayIndex}
          />
        </div>
        
        {user && (
          <div className="w-100 flex self-stretch">
            <UnassignedLessons 
              lessons={lessons}
              onTrashDrop={handleLessonDelete}
              onUnassignDrop={handleLessonUnassign}
              currentWeek={currentWeek}
              editMode={editMode}
              onLessonClick={handleLessonClick}
            />
          </div>
        )}
      </div>
      
      {selectedLessonId && (
        <EditLessonModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          lessonId={selectedLessonId}
          onSuccess={handleEditSuccess}
          weekDates={weekDates}
          allLessons={lessons}
          selectedTeacherId={selectedTeacherId}
        />
      )}
    </div>
  );
};

export default Schedule;
