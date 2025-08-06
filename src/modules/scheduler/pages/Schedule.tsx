import React, { useState, useEffect, Suspense, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from "@/core/contexts"
import { useLessons } from '../contexts/LessonsContext';
import { useTeachers } from '../contexts/TeachersContext';
import ScheduleHeader from '../components/scheduler/ScheduleHeader';
import TeacherSelector from '../components/scheduler/TeacherSelector';
import TimeGrid from '../components/scheduler/TimeGrid';
import NewLessonForm, { SelectedTeacherContext } from '../components/scheduler/NewLessonForm';
import UnassignedLessons from '../components/scheduler/UnassignedLessons';
import EditLessonModal from '../components/scheduler/EditLessonModal';
import { Edit, Move, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useSubjects } from '../contexts/SubjectsContext';
import { useLocations } from '../contexts/LocationsContext';
import { format, parseISO, addDays, isBefore, startOfDay, getDay, isWeekend, isSameDay, startOfWeek, endOfWeek, addWeeks, subWeeks, isAfter, addMinutes } from 'date-fns';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Lesson } from '../types';
import { supabase } from '@/core/lib/supabaseClient';
import { useStudentNames } from '../hooks/useStudentNames';
import { useSchool } from "@/core/contexts"
import { useDrag } from '../contexts/DragContext';

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

  // 1. PRIORITY: If currentDay is provided and has lessons, use it immediately
  if (currentDay !== null && currentDay >= 0 && currentDay < 5) {
    const hasLessonsOnCurrentDay = teacherLessons.some(l => l.day === currentDay);
    if (hasLessonsOnCurrentDay) {
      console.log("Current day", currentDay, "has lessons, using it as top priority");
      return currentDay;
    }
    console.log("Current day", currentDay, "has no lessons, looking for other options");
  }
  
  // 2. Find closest future day with lessons (starting from currentDay+1 or 0)
  const startDay = (currentDay !== null && currentDay >= 0 && currentDay < 4) ? currentDay + 1 : 0;
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
  
  // 4. Look for any day with lessons (final sweep)
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
    return isAfter(lessonDate, today) || isSameDay(lessonDate, today); // Include lessons today AND in the future
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
  const { draggedLesson: globalDraggedLesson } = useDrag();
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
    console.log("[DEBUG] Teacher selection effect - teachersLoading:", teachersLoading, "teachers.length:", teachers.length, "selectedTeacherId:", selectedTeacherId, "user:", user?.id, "isSchoolAdmin:", isSchoolAdmin);
    
    if (teachersLoading) {
      console.log("[DEBUG] Teacher selection effect - Still loading teachers, skipping");
      return;
    }
    
    console.log("[DEBUG] Teacher selection effect - Teachers loaded. Available teachers:", teachers.map(t => ({ id: t.id, name: t.name, active: t.active })));
    
    // For teachers (non-admin users), always set selectedTeacherId to their own ID
    if (!isSchoolAdmin && user && user.id) {
      console.log("[DEBUG] Teacher selection effect - User is a teacher (non-admin)");
      if (selectedTeacherId !== user.id) {
        console.log("[DEBUG] Teacher selection effect - Setting teacher's selectedTeacherId to their own ID:", user.id);
        setSelectedTeacherId(user.id);
      } else {
        console.log("[DEBUG] Teacher selection effect - Teacher's selectedTeacherId already correct:", user.id);
      }
      return;
    }
    
    // For school admins, use the normal teacher selection logic
    console.log("[DEBUG] Teacher selection effect - User is admin, processing teacher selection logic");
    if (teachers.length > 0) {
      const currentTeacherIsValid = teachers.some(t => t.id === selectedTeacherId);
      console.log("[DEBUG] Teacher selection effect - currentTeacherIsValid:", currentTeacherIsValid, "for selectedTeacherId:", selectedTeacherId);
      
      if (!selectedTeacherId || !currentTeacherIsValid) {
        console.log("[DEBUG] Teacher selection effect - Need to set new teacher ID");
        let newTeacherIdToSet = '';
        
        // Priority 1: If current user is a teacher, select them
        if (user && teachers.some(t => t.id === user.id)) {
          newTeacherIdToSet = user.id;
          console.log("[DEBUG] Teacher selection effect - Admin is also a teacher, setting to user.id:", user.id);
        } else {
          // Priority 2: First active teacher
          const firstActiveTeacher = teachers.find(t => t.active);
          if (firstActiveTeacher) {
            newTeacherIdToSet = firstActiveTeacher.id;
            console.log("[DEBUG] Teacher selection effect - Setting to first active teacher:", firstActiveTeacher.id, firstActiveTeacher.name);
          } else if (teachers.length > 0) {
            // Priority 3: Any teacher
            newTeacherIdToSet = teachers[0].id;
            console.log("[DEBUG] Teacher selection effect - No active teachers, setting to first teacher:", teachers[0].id, teachers[0].name);
          }
        }
        
        if (newTeacherIdToSet && selectedTeacherId !== newTeacherIdToSet) {
          console.log("[DEBUG] Teacher selection effect - CHANGING selectedTeacherId from", selectedTeacherId, "to", newTeacherIdToSet);
          setSelectedTeacherId(newTeacherIdToSet);
        } else {
          console.log("[DEBUG] Teacher selection effect - No change needed or no valid teacher found");
        }
      } else {
        console.log("[DEBUG] Teacher selection effect - Current teacher selection is valid, no change needed");
      }
    } else {
      console.log("[DEBUG] Teacher selection effect - No teachers available");
      if (selectedTeacherId !== '') {
        console.log("[DEBUG] Teacher selection effect - Clearing selectedTeacherId due to no teachers");
        setSelectedTeacherId('');
      }
    }
  }, [teachers, user, teachersLoading, selectedTeacherId, isSchoolAdmin]);
  
  // Effect for fetching lessons
  useEffect(() => {
    console.log("[DEBUG] Lesson fetching effect triggered");
    console.log("[DEBUG] - isSchoolAdmin:", isSchoolAdmin);
    console.log("[DEBUG] - user:", user?.id);
    console.log("[DEBUG] - selectedTeacherId:", selectedTeacherId);
    console.log("[DEBUG] - currentWeek:", currentWeek.toISOString().split('T')[0]);
    
    if (!isSchoolAdmin && user && user.id) {
      // For teachers, always fetch their own lessons using their user ID
      console.log("[DEBUG] Fetching lessons for teacher (non-admin):", user.id);
      fetchLessons(user.id, currentWeek);
    } else if (isSchoolAdmin && selectedTeacherId) {
      // For admins, fetch lessons for the selected teacher
      console.log("[DEBUG] Fetching lessons for admin's selected teacher:", selectedTeacherId);
      fetchLessons(selectedTeacherId, currentWeek);
    } else if (isSchoolAdmin && !selectedTeacherId) {
      console.log("[DEBUG] Admin has no selected teacher - cannot fetch lessons");
    } else {
      console.log("[DEBUG] Lesson fetching conditions not met - skipping");
    }
  }, [selectedTeacherId, currentWeek, fetchLessons, user, isSchoolAdmin]);
  
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
  
  const handleLessonDrop = (lessonId: string, day: number, time: string, slotDate: Date, sourceDate?: Date | null) => {
    console.log("[DEBUG] handleLessonDrop - CALLED with:", {
      lessonId,
      day,
      time,
      slotDate,
      sourceDate,
      selectedTeacherId
    });
    
    console.log("[DEBUG] handleLessonDrop - lessons array length:", lessons.length);
    console.log("[DEBUG] handleLessonDrop - lessons array sample:", lessons.slice(0, 3).map(l => ({
      id: l.id,
      student_name: l.student_name,
      teacher_id: l.teacher_id
    })));
    
    // If lessons array is empty, try to get lesson from global drag context
    const lesson = lessons.find(l => l.id === lessonId);
    
    if (!lesson && lessons.length === 0) {
      console.log("[DEBUG] handleLessonDrop - lessons not loaded, checking global drag context...");
      // The globalDraggedLesson only has id and duration, not the full lesson data
      // So we still can't proceed without the full lessons array
      if (globalDraggedLesson && globalDraggedLesson.id === lessonId) {
        console.log("[DEBUG] handleLessonDrop - lesson ID matches globalDraggedLesson but missing full lesson data");
        console.log("[DEBUG] handleLessonDrop - need to wait for lessons array to load");
        return; // Can't proceed without full lesson data
      }
    }
    
    console.log("[DEBUG] handleLessonDrop - found lesson:", lesson);
    
    if (!lesson) {
      console.log("[DEBUG] handleLessonDrop - EARLY RETURN: lesson not found");
      console.log("[DEBUG] handleLessonDrop - searching for lesson with ID:", lessonId);
      console.log("[DEBUG] handleLessonDrop - all lesson IDs in array:", lessons.map(l => l.id));
      console.log("[DEBUG] handleLessonDrop - globalDraggedLesson:", globalDraggedLesson);
      return;
    }
    
    // Ensure we have a valid teacher ID before proceeding
    const currentTeacherId = selectedTeacherId || null;
    console.log("[DEBUG] handleLessonDrop - currentTeacherId:", currentTeacherId);
    
    if (lesson.teacher_id === null && lesson.day === null && lesson.start_time === null) {
      console.log("[DEBUG] handleLessonDrop - CASE: Assign unassigned lesson");
      // Assign an unassigned lesson
      if (currentTeacherId) {
        console.log("[DEBUG] handleLessonDrop - calling assignLesson with:", {
          lessonId,
          currentTeacherId,
          day,
          time,
          slotDate
        });
        assignLesson(lessonId, currentTeacherId, day, time, slotDate);
      } else {
        console.error("[DEBUG] handleLessonDrop - ERROR: Cannot assign lesson: No teacher selected");
      }
    } 
    else if (lesson.teacher_id) {
      console.log("[DEBUG] handleLessonDrop - CASE: Reschedule existing lesson");
      
      // Calculate the original date to use
      let originalDate: Date;
      if (sourceDate) {
        // If we have the source date from the drag operation, use it (most accurate)
        originalDate = sourceDate;
        console.log("[DEBUG] handleLessonDrop - using sourceDate from drag:", originalDate);
      } else {
        // Fallback to the old logic when sourceDate is not available
        originalDate = lesson.day !== null ? weekDates[lesson.day] : currentWeek;
        console.log("[DEBUG] handleLessonDrop - using fallback originalDate:", originalDate);
      }
      
      // Reschedule an existing lesson using the specific date it was dragged from
      // Ensure we're always passing a valid teacher ID
      console.log("[DEBUG] handleLessonDrop - calling rescheduleLesson with:", {
        lessonId,
        originalDate,
        currentTeacherId,
        day,
        time,
        slotDate
      });
      
      // Add timestamp to track timing of calls
      console.log("[DEBUG] handleLessonDrop - rescheduleLesson call timestamp:", new Date().toISOString());
      
      rescheduleLesson(
        lessonId, 
        originalDate, // originalSlotDate - use the actual date where the lesson was dragged from
        currentTeacherId, // Use the stored value to prevent undefined
        day, 
        time, 
        slotDate // targetSlotDate - the date where it's being dropped
      );
    } else {
      console.log("[DEBUG] handleLessonDrop - CASE: Unhandled case - lesson has no teacher_id and is not fully unassigned");
      console.log("[DEBUG] handleLessonDrop - lesson.teacher_id:", lesson.teacher_id);
      console.log("[DEBUG] handleLessonDrop - lesson.day:", lesson.day);
      console.log("[DEBUG] handleLessonDrop - lesson.start_time:", lesson.start_time);
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
    if (editMode && isSchoolAdmin) {
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
          {!isSchoolAdmin && selectedTeacherName ? (
            <h1 className="text-2xl font-bold">Weekly schedule for {selectedTeacherName}</h1>
          ) : (
            <h1 className="text-2xl font-bold">Weekly Schedule</h1>
          )}
          {(!isMobileView || isSchoolAdmin) && (
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
              <ChevronRight className="h-4 w-4 mr-1" />
              Next Week
            </Button>
          </div>
        </div>
      </div>
      
      {/* Admin-only controls */}
      {isSchoolAdmin && (
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0">
            <TeacherSelector 
              selectedTeacherId={selectedTeacherId}
              onTeacherChange={setSelectedTeacherId}
            />
            <div className="flex space-x-2">
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
        </div>
      )}
      
      {isMobileView && !isSchoolAdmin && weekDates.length === 5 && (
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
      
      {isSchoolAdmin && (
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
            isAdmin={isSchoolAdmin}
            editMode={editMode}
            startHour={timeRange.startHour}
            startMinute={timeRange.startMinute}
            gridVisualEndHour={timeRange.gridVisualEndHour}
            gridVisualEndMinute={timeRange.gridVisualEndMinute}
            isMobileView={isMobileView}
            mobileSelectedDayIndex={mobileSelectedDayIndex}
          />
        </div>
        
        {isSchoolAdmin && (
          <div className="w-100 flex self-stretch sticky top-0">
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
