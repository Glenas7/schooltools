import React, { useState, useEffect } from 'react';
import { Lesson } from '../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useTeachers } from '../../contexts/TeachersContext';
import { useLessons } from '../../contexts/LessonsContext';
import { format, parseISO, addDays, isBefore, startOfDay } from 'date-fns';
import { Label as UILabel } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface EditLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  onSuccess: () => void;
  weekDates: Date[];
  allLessons: Lesson[];
  selectedTeacherId: string;
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
  const { updateLesson } = useLessons();
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [studentName, setStudentName] = useState('');
  const [duration, setDuration] = useState(30);
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Find the lesson from props and initialize form fields
  useEffect(() => {
    if (lessonId && allLessons.length > 0) {
      const foundLesson = allLessons.find(l => l.id === lessonId);
      if (foundLesson) {
        setLesson(foundLesson);
        setStudentName(foundLesson.student_name);
        setDuration(foundLesson.duration);
        setSubjectId(foundLesson.subject_id);
        setTeacherId(foundLesson.teacher_id || selectedTeacherId);
        setDayOfWeek(foundLesson.day);
        setStartTime(foundLesson.start_time);
        setStartDate(foundLesson.start_date);
        setEndDate(foundLesson.end_date);
      }
    }
  }, [lessonId, allLessons, selectedTeacherId]);
  
  // Validation function to check for overlaps
  const validateNoOverlaps = (): boolean => {
    if (!teacherId || dayOfWeek === null || !startTime) {
      // If any of these are missing, there can't be an overlap
      return true;
    }
    
    // Get all lessons for the same teacher on the same day
    const sameDayLessons = allLessons.filter(l => 
      l.id !== lessonId && // Exclude the lesson being edited
      l.teacher_id === teacherId && 
      l.day === dayOfWeek &&
      l.start_time !== null
    );
    
    // Calculate the start and end minutes of our edited lesson
    const [editHours, editMinutes] = startTime.split(':').map(Number);
    const editStartMinutes = editHours * 60 + editMinutes;
    const editEndMinutes = editStartMinutes + duration;
    
    // Check each lesson for overlap
    const overlappingLesson = sameDayLessons.find(l => {
      const [otherHours, otherMinutes] = l.start_time!.split(':').map(Number);
      const otherStartMinutes = otherHours * 60 + otherMinutes;
      const otherEndMinutes = otherStartMinutes + l.duration;
      
      // Check if time ranges overlap
      return (
        (editStartMinutes < otherEndMinutes && editEndMinutes > otherStartMinutes) &&
        // Check date range overlap if both have start dates
        (!startDate || !l.start_date || 
          // If both have end dates, check for date range overlap
          (!endDate || !l.end_date || 
            isBefore(parseISO(startDate), parseISO(l.end_date)) && 
            isBefore(parseISO(l.start_date), endDate ? parseISO(endDate) : addDays(new Date(), 365))
          )
        )
      );
    });
    
    return !overlappingLesson;
  };
  
  const handleSubmit = async () => {
    setError(null);
    
    // Basic validation
    if (!studentName.trim()) {
      setError('Student name is required');
      return;
    }
    
    if (!subjectId) {
      setError('Subject is required');
      return;
    }
    
    // Check for time conflicts
    if (teacherId && dayOfWeek !== null && startTime && !validateNoOverlaps()) {
      setError('This time slot overlaps with another lesson for this teacher');
      return;
    }
    
    // Date validation
    if (startDate && endDate && isBefore(parseISO(endDate), parseISO(startDate))) {
      setError('End date must be after start date');
      return;
    }
    
    // All validation passed, update the lesson
    try {
      setLoading(true);
      
      await updateLesson({
        id: lessonId,
        student_name: studentName.trim(),
        duration,
        teacher_id: teacherId,
        day: dayOfWeek,
        start_time: startTime,
        subject_id: subjectId,
        start_date: startDate,
        end_date: endDate
      });
      
      setLoading(false);
      onSuccess();
    } catch (err) {
      setLoading(false);
      setError('Failed to update lesson. Please try again.');
      console.error('Error updating lesson:', err);
    }
  };
  
  // Helper to format time for the select input
  const formatTimeForSelect = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };
  
  // Generate time options (from 8:00 AM to 6:30 PM in 30-minute intervals)
  const timeOptions = [];
  for (let hour = 8; hour < 19; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      // Stop at 18:30, don't include 19:00
      if (hour === 18 && minute === 30) {
        timeOptions.push(formatTimeForSelect(hour, minute));
        break;
      }
      timeOptions.push(formatTimeForSelect(hour, minute));
    }
  }
  
  // Generate day options
  const dayOptions = weekDates.map((date, index) => ({
    value: index,
    label: `${format(date, 'EEEE')} (${format(date, 'MMM d')})`
  }));
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lesson</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <UILabel htmlFor="student-name">Student Name</UILabel>
            <Input
              id="student-name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter student name"
            />
          </div>
          
          <div className="space-y-2">
            <UILabel htmlFor="duration">Duration (minutes)</UILabel>
            <div className="flex items-center space-x-2">
              <Input
                id="duration"
                type="number"
                min={15}
                max={90}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Math.max(15, Math.min(90, parseInt(e.target.value) || 30)))}
                className="w-20"
              />
              <div className="flex space-x-1">
                {[30, 45, 60].map((mins) => (
                  <Button
                    key={mins}
                    variant={duration === mins ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDuration(mins)}
                  >
                    {mins}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <UILabel htmlFor="subject">Subject</UILabel>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
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
          
          <div className="space-y-2">
            <UILabel htmlFor="teacher">Teacher</UILabel>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <UILabel htmlFor="day">Day</UILabel>
            <Select 
              value={dayOfWeek !== null ? dayOfWeek.toString() : ''} 
              onValueChange={(value) => setDayOfWeek(value ? parseInt(value) : null)}
              disabled={!teacherId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {dayOptions.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <UILabel htmlFor="time">Time</UILabel>
            <Select 
              value={startTime || ''} 
              onValueChange={setStartTime}
              disabled={!teacherId || dayOfWeek === null}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
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
            <UILabel htmlFor="end-date">End Date</UILabel>
            <Input
              id="end-date"
              type="date"
              value={endDate || ''}
              onChange={(e) => setEndDate(e.target.value || null)}
              min={startDate || undefined}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditLessonModal; 