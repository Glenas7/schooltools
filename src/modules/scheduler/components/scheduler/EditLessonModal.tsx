import React, { useState, useEffect, useRef } from 'react';
import { Lesson } from '../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useTeachers } from '../../contexts/TeachersContext';
import { useLocations } from '../../contexts/LocationsContext';
import { useLessons } from '../../contexts/LessonsContext';
import { format, parseISO, addDays, isBefore, startOfDay, addMinutes } from 'date-fns';
import { Label as UILabel } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useStudentNames } from '../../hooks/useStudentNames';

// Helper function to normalize strings (remove accents)
const normalizeString = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

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
  selectedTeacherId
}: EditLessonModalProps) => {
  const { subjects } = useSubjects();
  const { teachers } = useTeachers();
  const { locations, getLessonLocation, assignLocationToLesson, removeLocationFromLesson } = useLocations();
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
  const [locationId, setLocationId] = useState<string>('');
  
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
        
        // Load location for this lesson
        getLessonLocation(foundLesson.id).then(location => {
          setLocationId(location?.id || '');
        });
      } else {
        console.warn(`EditLessonModal: Lesson with ID ${lessonId} not found.`);
      }
    }
    if (isOpen) {
      setIsAutocompleteOpen(false);
      setSuggestions([]);
      setAutocompleteSelectedIndex(-1);
    }
  }, [isOpen, lessonId, allLessons, getLessonLocation]);
  
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
      const newTime = formatTimeForSelect(newHour, currentMinute);
      setStartTime(newTime);
    }
  };

  const handleMinuteChange = (value: string) => {
    const newMinute = parseInt(value, 10);
    if (!isNaN(newMinute)) {
      const newTime = formatTimeForSelect(currentHour, newMinute);
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
      
      // Handle location assignment/removal
      if (locationId) {
        await assignLocationToLesson(lessonId, locationId);
      } else {
        await removeLocationFromLesson(lessonId);
      }
      
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError('Failed to update lesson. Please try again.');
      console.error('Error updating lesson:', err);
    }
  };
  
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
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2 relative">
            <UILabel htmlFor="edit-student-name">Student Name</UILabel>
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
              <UILabel htmlFor="edit-duration">Duration (minutes)</UILabel>
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
              <UILabel htmlFor="edit-subject">Subject</UILabel>
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
            <UILabel htmlFor="edit-teacher">Teacher</UILabel>
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
                {teachers.filter(t => t.active).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <UILabel htmlFor="edit-location">Location</UILabel>
            <Select value={locationId || "none"} onValueChange={(value) => setLocationId(value === "none" ? "" : value)}>
              <SelectTrigger id="edit-location">
                <SelectValue placeholder="No location selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {teacherId && teacherId !== "unassigned" && (
            <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
                <UILabel htmlFor="edit-dayOfWeek">Day of the Week</UILabel>
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
                <UILabel htmlFor="edit-startTimeHour">Start Time</UILabel>
                <div className="flex items-center space-x-2">
                  <Select 
                    value={currentHour.toString()} 
                    onValueChange={handleHourChange}
                    disabled={!teacherId || teacherId === "unassigned" || dayOfWeek === null}
                  >
                    <SelectTrigger id="edit-startTimeHour" className="w-[85px]">
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
                    <SelectTrigger id="edit-startTimeMinute" className="w-[70px]">
                      <SelectValue placeholder="00">
                        {currentMinute.toString().padStart(2, '0')}
                      </SelectValue>
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
              <UILabel htmlFor="start-date">Start Date</UILabel>
            <Input
              id="start-date"
              type="date"
              value={startDate || ''}
              onChange={(e) => setStartDate(e.target.value || null)}
            />
          </div>
          
          <div className="space-y-2">
              <UILabel htmlFor="end-date">End Date* (Optional)</UILabel>
            <Input
              id="end-date"
              type="date"
              value={endDate || ''}
              onChange={(e) => setEndDate(e.target.value || null)}
              min={startDate || undefined}
            />
            </div>
          </div>
          <span className="text-xs italic text-gray-500">
            *This should be the first day on which there will no longer be a lesson, not the last day with a lesson.
          </span>
        </div>
        
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

export default EditLessonModal; 