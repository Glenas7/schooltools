import React, { useState, useEffect, useRef } from 'react';
import { format, isAfter, isBefore, isEqual, startOfDay } from 'date-fns';
import { Lesson } from '../../types';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useDrag } from '../../contexts/DragContext';

interface TimeGridProps {
  weekDates: Date[];
  lessons: Lesson[];
  selectedTeacherId: string;
  onLessonDrop: (lessonId: string, day: number, time: string, date: Date, sourceDate?: Date | null) => void;
  onLessonClick?: (lessonId: string) => void;
  isAdmin: boolean;
  editMode?: boolean;
  startHour?: number; 
  startMinute?: 0 | 30;
  gridVisualEndHour?: number;
  gridVisualEndMinute?: 0 | 30;
  isMobileView?: boolean;
  mobileSelectedDayIndex?: number;
}

const generateTimeSlots = (sH: number = 8, sM: 0 | 30 = 0, visualEH: number = 19, visualEM: 0 | 30 = 0) => {
  const slots = [];
  let currentHour = sH;
  let currentMinute = sM;

  const endTotalMinutes = visualEH * 60 + visualEM;

  while (currentHour * 60 + currentMinute < endTotalMinutes) {
    slots.push(`${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`);
    currentMinute += 30;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour++;
    }
  }
  return slots;
};

const TimeGrid = ({ 
  weekDates, 
  lessons, 
  selectedTeacherId, 
  onLessonDrop, 
  onLessonClick, 
  isAdmin, 
  editMode = false,
  startHour = 8,  
  startMinute = 0,
  gridVisualEndHour = 19,
  gridVisualEndMinute = 0,
  isMobileView = false,
  mobileSelectedDayIndex = 0
}: TimeGridProps) => {
  console.log(`[TimeGrid] Props received - startHour: ${startHour}, startMinute: ${startMinute}, visualEndHour: ${gridVisualEndHour}, visualEndMinute: ${gridVisualEndMinute}`);

  const timeSlots = generateTimeSlots(startHour, startMinute, gridVisualEndHour, gridVisualEndMinute);
  const { subjects } = useSubjects();
  const { draggedLesson: globalDraggedLesson } = useDrag();
  
  const getSubjectById = (subjectId: string) => {
    return subjects.find(subject => subject.id === subjectId);
  };
  
  // Local dragged lesson state for internal drags
  const [draggedLesson, setDraggedLesson] = useState<{
    id: string;
    duration: number;
  } | null>(null);
  
  // Track both the user's cursor position and the collision-free valid position
  const [dragPreview, setDragPreview] = useState<{ 
    day: number; 
    time: string; 
    yPosition: number;
    // Add new properties to track original position vs valid position
    originalPosition?: number;
    isRepositioned?: boolean;
  } | null>(null);
  
  // Track if we're in an active drag operation
  const [isActiveDrag, setIsActiveDrag] = useState(false);
  
  // Store persistent drag state that survives state resets during drag operation
  const persistentDragState = useRef<{
    lessonId: string | null;
    lessonDuration: number | null;
    hasValidDragData: boolean;
    isDragInProgress: boolean; // Track if we're in the middle of a drag
    lastValidPreview: { day: number; time: string; yPosition: number; originalPosition?: number; isRepositioned?: boolean } | null;
    isProcessed: boolean; // NEW: Track if this drag operation has already been processed
  }>({
    lessonId: null,
    lessonDuration: null,
    hasValidDragData: false,
    isDragInProgress: false,
    lastValidPreview: null,
    isProcessed: false
  });
  
  // Use refs to store current state values that event handlers can access
  const dragStateRef = useRef({
    isActiveDrag: false,
    draggedLesson: null as { id: string; duration: number } | null,
    dragPreview: null as { day: number; time: string; yPosition: number; originalPosition?: number; isRepositioned?: boolean } | null
  });
  
  // Update refs whenever state changes
  useEffect(() => {
    dragStateRef.current.isActiveDrag = isActiveDrag;
    
    // Mark drag as in progress when isActiveDrag becomes true
    if (isActiveDrag && !persistentDragState.current.isDragInProgress) {
      persistentDragState.current.isDragInProgress = true;
    }
  }, [isActiveDrag]);
  
  useEffect(() => {
    dragStateRef.current.draggedLesson = draggedLesson;
    
    // Store persistent drag data when drag starts
    if (draggedLesson && !persistentDragState.current.hasValidDragData) {
      persistentDragState.current.lessonId = draggedLesson.id;
      persistentDragState.current.lessonDuration = draggedLesson.duration;
      persistentDragState.current.hasValidDragData = true;
    }
    
    // Only clear persistent data if we're not in the middle of a drag operation
    // This prevents clearing during intermediate re-renders while dragging
    if (!draggedLesson && persistentDragState.current.hasValidDragData && !persistentDragState.current.isDragInProgress) {
      persistentDragState.current.lessonId = null;
      persistentDragState.current.lessonDuration = null;
      persistentDragState.current.hasValidDragData = false;
    }
  }, [draggedLesson]);
  
  useEffect(() => {
    dragStateRef.current.dragPreview = dragPreview;
    
    // Store the dragPreview in persistent state so it survives re-renders
    if (dragPreview && persistentDragState.current.isDragInProgress) {
      persistentDragState.current.lastValidPreview = dragPreview;
    }
  }, [dragPreview]);
  
  // Update our local state when global state changes
  useEffect(() => {
    // If there's a global drag going on, update our local state
    if (globalDraggedLesson) {
      setDraggedLesson(globalDraggedLesson);
    }
  }, [globalDraggedLesson]);
  
  // Use filtered lessons for the current teacher and visual constraints
  const visibleLessons = lessons.filter(lesson => {
    // Only show lessons for the selected teacher
    if (lesson.teacher_id !== selectedTeacherId) return false;
    
    // Must have day and start_time to display
    if (lesson.day === null || lesson.start_time === null) return false;
    
    // Safety check: day index must be valid for the current week
    if (lesson.day < 0 || lesson.day >= weekDates.length) return false;
    
    // For assigned lessons, check if they should be visible in the current week by checking their start/end dates
    if (lesson.start_date) {
      // Get the actual date from the current week that corresponds to the lesson's day
      const lessonDayInCurrentWeek = weekDates[lesson.day];
      
      // Properly compare dates by setting both to start of day to avoid time issues
      const startDate = startOfDay(new Date(lesson.start_date));
      const currentDayDate = startOfDay(new Date(lessonDayInCurrentWeek));
      
      // The lesson is visible if it starts on or before this week's instance of the lesson day
      const startsBeforeOrOnLessonDay = isBefore(startDate, currentDayDate) || 
                                       isEqual(startDate, currentDayDate);
      
      // If the lesson has an end date, it should only be visible if that date is strictly after
      // the PREVIOUS week's instance of the lesson day
      if (lesson.end_date) {
        const endDate = startOfDay(new Date(lesson.end_date));
        
        // A lesson ending on 15-05 should not be visible on 15-05,
        // but it SHOULD be visible on 08-05
        return startsBeforeOrOnLessonDay && isAfter(endDate, currentDayDate);
      }
      
      // If there's no end date, the lesson is recurring indefinitely
      return startsBeforeOrOnLessonDay;
    }
    
    return true;
  });
  
  useEffect(() => {
    // For debugging
    console.log("TimeGrid received lessons:", lessons.length);
    console.log("TimeGrid visible lessons:", visibleLessons.length);
  }, [lessons, visibleLessons.length]);
    
  // Directly use props for this critical calculation
  const gridStartTotalMinutes = startHour * 60 + startMinute;
  console.log(`[TimeGrid] Calculated gridStartTotalMinutes: ${gridStartTotalMinutes} (from ${startHour}:${startMinute})`);

  const timeToAbsoluteMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  
  const absoluteMinutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getMinutesSinceGridStart = (time: string): number => {
    const absoluteMins = timeToAbsoluteMinutes(time);
    const result = absoluteMins - gridStartTotalMinutes;
    // console.log(`[TimeGrid] getMinutesSinceGridStart for ${time} (abs: ${absoluteMins}): ${result}`);
    return result;
  };
  
  const timeToYPosition = (time: string): number => {
    const minutesSinceGridStart = getMinutesSinceGridStart(time);
    return minutesSinceGridStart * 1.6; // 96px per hour / 60 mins = 1.6px per minute
  };
  
  const yPositionToTime = (yPosition: number): string => {
    const minutesFromGridStartUnsnapped = yPosition / 1.6;
    // Snap to 5-minute increments relative to grid start
    const snappedMinutesFromGridStart = Math.round(minutesFromGridStartUnsnapped / 5) * 5;
    const totalAbsoluteMinutes = gridStartTotalMinutes + snappedMinutesFromGridStart;
    return absoluteMinutesToTime(totalAbsoluteMinutes);
  };
    
  const durationToHeight = (duration: number): number => duration * 1.6;

  // Try to find a lesson by ID in all possible sources
  const findLessonById = (id: string): Lesson | undefined => {
    // Look in combined lessons first
    let lesson = visibleLessons.find(l => l.id === id);
    if (lesson) return lesson;
    
    // Look in all lessons, including unassigned
    lesson = lessons.find(l => l.id === id);
    if (lesson) return lesson;
    
    return undefined;
  };

  // Check if two time slots overlap
  const doLessonsOverlap = (
    startTime1: string,
    duration1: number,
    startTime2: string,
    duration2: number
  ): boolean => {
    const start1Mins = getMinutesSinceGridStart(startTime1);
    const end1Mins = start1Mins + duration1;
    const start2Mins = getMinutesSinceGridStart(startTime2);
    const end2Mins = start2Mins + duration2;
    return start1Mins < end2Mins && start2Mins < end1Mins;
  };
  
  // Find the nearest valid position for a lesson that avoids overlaps
  const findNearestValidPosition = (
    day: number,
    proposedTime: string,
    lessonDuration: number
  ): { time: string; yPosition: number } => {
    // Get all lessons for this day, excluding the currently dragged lesson to avoid self-collision
    const isDraggingExistingLesson = draggedLesson ? !!visibleLessons.find(l => l.id === draggedLesson.id) : false;
    
    const lessonsForDay = visibleLessons.filter(lesson => 
      lesson.day === day && 
      lesson.start_time !== null &&
      (!isDraggingExistingLesson || (draggedLesson && lesson.id !== draggedLesson.id))
    );
    
    const proposedMinutes = getMinutesSinceGridStart(proposedTime);
    
    if (lessonsForDay.length === 0 || !lessonsForDay.some(l => doLessonsOverlap(proposedTime, lessonDuration, l.start_time!, l.duration))) {
      return { 
        time: proposedTime, 
        yPosition: timeToYPosition(proposedTime)
      };
    }
    
    const possiblePositions = [];
    const lessonBoundaries = [];
    
    lessonBoundaries.push({ 
      timeMinutes: 0, 
      type: 'start',
      isValid: true 
    });
    
    const gridVisualEndAbsoluteMinutes = timeToAbsoluteMinutes(`${gridVisualEndHour}:${gridVisualEndMinute}`);
    const gridVisualEndMinutesFromGridStart = gridVisualEndAbsoluteMinutes - gridStartTotalMinutes;
    lessonBoundaries.push({ 
      timeMinutes: gridVisualEndMinutesFromGridStart, 
      type: 'end',
      isValid: true
    });
    
    lessonsForDay.forEach(lesson => {
      const startM = getMinutesSinceGridStart(lesson.start_time!);
      lessonBoundaries.push({ 
        timeMinutes: startM, 
        type: 'start',
        isValid: startM >= lessonDuration 
      });
      
      lessonBoundaries.push({ 
        timeMinutes: startM + lesson.duration, 
        type: 'end',
        isValid: (startM + lesson.duration + lessonDuration) <= gridVisualEndMinutesFromGridStart 
      });
    });
    
    lessonBoundaries.sort((a, b) => a.timeMinutes - b.timeMinutes);
    
    for (const boundary of lessonBoundaries) {
      let startPositionToCheck: number | null = null;
      if (boundary.type === 'end' && boundary.isValid) startPositionToCheck = boundary.timeMinutes;
      if (boundary.type === 'start' && boundary.isValid) startPositionToCheck = boundary.timeMinutes - lessonDuration;

      if (startPositionToCheck !== null && startPositionToCheck >= 0 && (startPositionToCheck + lessonDuration) <= gridVisualEndMinutesFromGridStart) {
        const timeToCheck = absoluteMinutesToTime(gridStartTotalMinutes + startPositionToCheck);
        if (!lessonsForDay.some(l => doLessonsOverlap(timeToCheck, lessonDuration, l.start_time!, l.duration))) {
          possiblePositions.push({ time: timeToCheck, yPosition: timeToYPosition(timeToCheck), distance: Math.abs(proposedMinutes - startPositionToCheck) });
        }
      }
    }

    if (possiblePositions.length > 0) {
      possiblePositions.sort((a, b) => a.distance - b.distance);
      return { time: possiblePositions[0].time, yPosition: possiblePositions[0].yPosition };
    }
    
    return {
      time: absoluteMinutesToTime(gridStartTotalMinutes),
      yPosition: 0
    };
  };

  const handleDragOver = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    if (isAdmin) {
      e.dataTransfer.dropEffect = "move";
      
      // Mark that we're in an active drag
      setIsActiveDrag(true);

      // Determine current lesson's duration for clamping
      let currentLessonDuration = 30; // Default duration
      const activeLessonInfo = globalDraggedLesson || draggedLesson; // Check context/local state first

      if (activeLessonInfo) {
        currentLessonDuration = activeLessonInfo.duration;
      } else {
        // Fallback: Try to read duration from dataTransfer
        try {
          const dtDurationStr = e.dataTransfer.getData('lessonDuration');
          if (dtDurationStr) {
            const parsedDuration = parseInt(dtDurationStr, 10);
            if (!isNaN(parsedDuration)) {
              currentLessonDuration = parsedDuration;
            }
          }
        } catch (err) {
          // Silently catch if dataTransfer is not readable
        }
      }

      const lessonHeight = durationToHeight(currentLessonDuration);
      
      // Get position of mouse relative to column
      const columnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relativeY = e.clientY - columnRect.top;
      
      // Grid boundaries in pixels
      const minY = 0; // startHour:00 (top of grid)
      const gridEndTimeY = (gridVisualEndHour - startHour) * 96; // endHour:00 (bottom of grid)
      const maxYForLessonTop = gridEndTimeY - lessonHeight; // Max Y for lesson top
      
      // Ensure the lesson never starts before startHour:00
      // This explicit check reinforces the clamping
      const clampedMouseY = Math.max(minY, Math.min(relativeY, maxYForLessonTop));
      
      // Convert to time and back to get snapping behavior
      // yPositionToTime will ensure time never goes before startHour:00
      const time = yPositionToTime(clampedMouseY);
      
      // Store the original snapped position (ignoring collisions)
      const originalYPosition = timeToYPosition(time);
      
      // Find the nearest valid position that avoids overlaps
      const validPosition = findNearestValidPosition(day, time, currentLessonDuration);
      
      // Check if we had to reposition due to collision
      const isRepositioned = validPosition.time !== time;
      
      // Set the preview
      setDragPreview({ 
        day, 
        time: validPosition.time,
        yPosition: validPosition.yPosition,
        originalPosition: originalYPosition,
        isRepositioned
      });
      
      // Try to set draggedLesson state from dataTransfer if not already set
      if (!draggedLesson) {
        try {
          const lessonIdFromDT = e.dataTransfer.getData('lesson');
          if (lessonIdFromDT) {
            const lessonObject = findLessonById(lessonIdFromDT);
            if (lessonObject) {
              setDraggedLesson({ id: lessonObject.id, duration: lessonObject.duration });
            } else {
              // If lesson not found by ID, try duration from dataTransfer
              const durationFromDTStr = e.dataTransfer.getData('lessonDuration');
              if (durationFromDTStr) {
                const parsedDuration = parseInt(durationFromDTStr, 10);
                if (!isNaN(parsedDuration)) {
                  setDraggedLesson({ id: lessonIdFromDT, duration: parsedDuration });
                }
              }
            }
          }
        } catch (error) {
          // Expected if dataTransfer is not readable
        }
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Check if we're actually leaving the grid area or just moving between child elements
    const relatedTarget = e.relatedTarget as Element;
    
    // Only clear preview if we're not in an active drag operation
    // AND we're actually leaving the grid (not just moving between elements)
    if (!isActiveDrag && (!relatedTarget || !e.currentTarget.contains(relatedTarget))) {
    setDragPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    
    // End the active drag
    setIsActiveDrag(false);
    
    // Check if this drag operation has already been processed
    if (persistentDragState.current.isProcessed) {
      console.log("[TimeGrid] handleDrop - drag already processed, skipping");
      return;
    }
    
    if (isAdmin && dragPreview) {
      // Mark as processed to prevent duplicate handling
      persistentDragState.current.isProcessed = true;
      
      // Try to get lessonId from draggedLesson or dataTransfer
      let lessonId = '';
      let sourceDayIndex: number | null = null;
      
      // First priority: use our stored draggedLesson state
      if (draggedLesson) {
        lessonId = draggedLesson.id;
      } 
      // Second priority: try to read from dataTransfer
      else {
        try {
          lessonId = e.dataTransfer.getData('lesson');
        } catch (error) {
          // Expected if dataTransfer is not readable
        }
      }
      
      // Try to get the source day index from dataTransfer
      try {
        const sourceDayStr = e.dataTransfer.getData('sourceDayIndex');
        if (sourceDayStr) {
          sourceDayIndex = parseInt(sourceDayStr, 10);
        }
      } catch (error) {
        // Expected if dataTransfer is not readable
      }
      
      if (lessonId) {
        // Get the actual date from the weekDates array for the column where the lesson is dropped
        const columnDate = weekDates[day];
        // Get the source date if we have the source day index
        const sourceDate = sourceDayIndex !== null ? weekDates[sourceDayIndex] : null;
        // Use calculated time from dragPreview and pass the actual date
        onLessonDrop(lessonId, day, dragPreview.time, columnDate, sourceDate);
      }
      
      // Reset states
      setDragPreview(null);
      setDraggedLesson(null);
    }
  };

  // Create lighter version of the color for background - same as in UnassignedLessons
  const getLighterColor = (hexColor: string) => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Parse the RGB components
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Mix with white (255,255,255) at 85% opacity
    const lighterR = Math.floor(r + (255 - r) * 0.85);
    const lighterG = Math.floor(g + (255 - g) * 0.85);
    const lighterB = Math.floor(b + (255 - b) * 0.85);
    
    // Convert back to hex
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  const getLessonStyle = (lesson: Lesson) => {
    if (lesson.start_time === null || lesson.day === null) return {};
    // console.log(`[TimeGrid] getLessonStyle for ${lesson.student_name} at ${lesson.start_time}`); // Uncomment for verbose logging
    const topPosition = timeToYPosition(lesson.start_time);
    // console.log(`[TimeGrid] For ${lesson.student_name} (${lesson.start_time}), minutesSinceGridStart: ${getMinutesSinceGridStart(lesson.start_time!)}, topPosition: ${topPosition}px`); // Uncomment for verbose logging
    const heightInPixels = durationToHeight(lesson.duration);
    const subject = getSubjectById(lesson.subject_id);
    const color = subject?.color || '#9b87f5';
    const bgColor = getLighterColor(color);
    
    return {
      position: 'absolute' as const,
      top: `${topPosition}px`,
      left: '4px',
      right: '4px',
      height: `${heightInPixels}px`,
      backgroundColor: bgColor,
      borderLeft: `4px solid ${color}`,
      borderRadius: '0.375rem',
      cursor: isAdmin ? (editMode ? 'pointer' : 'move') : 'default',
    };
  };

  // Calculate drag preview style based on position
  const getDragPreviewStyle = (): React.CSSProperties | undefined => {
    if (!dragPreview) {
      return undefined;
    }
    
    // First try globalDraggedLesson, then local draggedLesson, then default
    let duration = 30;
    if (globalDraggedLesson) {
      duration = globalDraggedLesson.duration;
    } else if (draggedLesson) {
      duration = draggedLesson.duration;
    }
    
    // Always use the stored lesson duration or default
    const heightInPixels = durationToHeight(duration);
    
    // Get color for the drag preview
    const color = '#9b87f5'; // Default purple color
    
    // If we're showing a repositioned preview (due to collision), show different styling
    if (dragPreview.isRepositioned && dragPreview.originalPosition !== undefined) {
      // Return a group of elements
      return {
        position: 'absolute',
        top: `${dragPreview.yPosition}px`,
        left: '4px',
        right: '4px',
        height: `${heightInPixels}px`,
        backgroundColor: 'rgba(155, 135, 245, 0.3)', // Lighter purple with transparency
        borderLeft: `4px solid ${color}`,
        borderRadius: '0.375rem',
        border: '2px solid #9b87f5',
        pointerEvents: 'none',
        zIndex: 10
      };
    }
    
    // Default preview style (no collision)
    return {
      position: 'absolute',
      top: `${dragPreview.yPosition}px`,
      left: '4px',
      right: '4px',
      height: `${heightInPixels}px`,
      backgroundColor: 'rgba(155, 135, 245, 0.2)', // Lighter purple with transparency
      borderLeft: `4px solid ${color}`,
      border: '2px dashed #9b87f5',
      borderRadius: '0.375rem',
      pointerEvents: 'none',
      zIndex: 10
    };
  };

  // Second preview to show original position when repositioned
  const getOriginalPositionStyle = (): React.CSSProperties | undefined => {
    if (!dragPreview || 
        !dragPreview.isRepositioned || 
        dragPreview.originalPosition === undefined) {
      return undefined;
    }
    
    // First try globalDraggedLesson, then local draggedLesson, then default
    let duration = 30;
    if (globalDraggedLesson) {
      duration = globalDraggedLesson.duration;
    } else if (draggedLesson) {
      duration = draggedLesson.duration;
    }
    
    // Always use the stored lesson duration or default
    const heightInPixels = durationToHeight(duration);
    
    // Show a ghost at the original position to indicate why we repositioned
    return {
      position: 'absolute',
      top: `${dragPreview.originalPosition}px`,
      left: '4px',
      right: '4px',
      height: `${heightInPixels}px`,
      backgroundColor: 'rgba(255, 99, 71, 0.15)', // Red with transparency to indicate collision
      border: '2px dashed rgba(255, 99, 71, 0.5)',
      borderRadius: '0.375rem',
      pointerEvents: 'none',
      zIndex: 9
    };
  };

  // Global event listeners to handle dragging outside the grid
  useEffect(() => {
    // Only add these listeners if we're in an active drag
    if (!isActiveDrag || !isAdmin) {
      return;
    }
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Get current values from ref
      const currentDraggedLesson = dragStateRef.current.draggedLesson;
      if (!currentDraggedLesson) {
        return;
      }
      
      // Check if we're hovering over special drop zones (unassigned lessons, trash)
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
      if (elementUnderMouse) {
        // Check for trash zone - look for elements with trash drop handlers
        const isOverTrashZone = elementUnderMouse.closest('[class*="border-red"]') ||
                               elementUnderMouse.closest('[class*="bg-red"]') ||
                               elementUnderMouse.closest('*')?.querySelector('[class*="Trash2"]') ||
                               // Check if any parent has onDragDrop for trash (we need to check if it's a trash card)
                               !!elementUnderMouse.closest('div')?.textContent?.includes('Drop here to delete');
        
        // Check for unassigned lessons zone - look for the scrollable area with drag handlers
        const isOverUnassignedZone = elementUnderMouse.closest('.overflow-y-auto') ||
                                    elementUnderMouse.closest('[class*="border-purple"]') ||
                                    elementUnderMouse.closest('*')?.querySelector('[placeholder*="Search lessons"]') ||
                                    // Check if it's within the UnassignedLessons card area
                                    !!elementUnderMouse.closest('div')?.textContent?.includes('Unassigned Lessons');
        
        if (isOverTrashZone || isOverUnassignedZone) {
          // Clear preview when over special drop zones
          setDragPreview(null);
          return;
        }
      }
      
      // Find the day column the mouse is over
      const columns = document.querySelectorAll('.day-column');
      let targetDay = -1;
      let targetColumn: Element | null = null;
      
      columns.forEach((column, index) => {
        const rect = column.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          targetDay = index;
          targetColumn = column;
        }
      });
      
      // If we found a column, update the preview
      if (targetDay >= 0 && targetColumn) {
        const columnRect = (targetColumn as HTMLElement).getBoundingClientRect();
        const relativeY = e.clientY - columnRect.top;
        
        // Apply the same clamping logic as in handleDragOver
        const currentLessonDuration = currentDraggedLesson.duration;
        const lessonHeight = durationToHeight(currentLessonDuration);
        
        const minY = 0;
        const gridEndTimeY = (gridVisualEndHour - startHour) * 96;
        const maxYForLessonTop = gridEndTimeY - lessonHeight;
        
        // Clamp mouse Y position
        const clampedMouseY = Math.max(minY, Math.min(relativeY, maxYForLessonTop));
        
        // Convert to time and back to get snapping behavior
        const time = yPositionToTime(clampedMouseY);
        
        // Get the original snapped position without collision detection
        const originalYPosition = timeToYPosition(time);
        
        // Find the nearest valid position that avoids overlaps
        const validPosition = findNearestValidPosition(targetDay, time, currentLessonDuration);
        
        // Check if we had to reposition due to collision
        const isRepositioned = validPosition.time !== time;
        
        // Update preview
        setDragPreview({
          day: targetDay,
          time: validPosition.time,
          yPosition: validPosition.yPosition,
          originalPosition: originalYPosition,
          isRepositioned
        });
      } else {
        // Not over any day column, clear preview
        setDragPreview(null);
      }
    };
    
    const handleGlobalMouseUp = () => {
      // Get current values from ref
      const currentDragPreview = dragStateRef.current.dragPreview;
      const currentDraggedLesson = dragStateRef.current.draggedLesson;
      
      // End the drag when mouse is released
      setIsActiveDrag(false);
      
      // Check if this drag operation has already been processed
      if (persistentDragState.current.isProcessed) {
        console.log("[TimeGrid] handleGlobalMouseUp - drag already processed, skipping");
        return;
      }
      
      // If we have a valid drag preview and lesson, place the lesson there
      if (isAdmin && currentDragPreview && currentDraggedLesson) {
        // Mark as processed to prevent duplicate handling
        persistentDragState.current.isProcessed = true;
        
        // Get the actual date from the weekDates array for the column where the lesson would be dropped
        const columnDate = weekDates[currentDragPreview.day];
        // Use calculated time from dragPreview and pass the actual date
        // Note: sourceDate is null for global drag operations since we don't track it
        onLessonDrop(currentDraggedLesson.id, currentDragPreview.day, currentDragPreview.time, columnDate, null);
        
        // Reset states
        setDragPreview(null);
        setDraggedLesson(null);
      }
    };
    
    // Add global event listeners
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      // Clean up event listeners
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isActiveDrag, isAdmin]); // Simplified dependencies

  // Add global listeners for drag events to capture unassigned lessons from other components
  useEffect(() => {
    // This helps us track cross-component drags
    const handleGlobalDragOver = (_: DragEvent) => {
      // Don't try to read data here - it will throw an error
    };

    const handleGlobalDragEnd = (e: DragEvent) => {
      // Check if the drop happened over special drop zones (unassigned lessons, trash)
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
      if (elementUnderMouse) {
        // Check for trash zone - look for elements with trash drop handlers
        const isOverTrashZone = elementUnderMouse.closest('[class*="border-red"]') ||
                               elementUnderMouse.closest('[class*="bg-red"]') ||
                               elementUnderMouse.closest('*')?.querySelector('[class*="Trash2"]') ||
                               // Check if any parent has onDragDrop for trash (we need to check if it's a trash card)
                               !!elementUnderMouse.closest('div')?.textContent?.includes('Drop here to delete');
        
        // Check for unassigned lessons zone - look for the scrollable area with drag handlers
        const isOverUnassignedZone = elementUnderMouse.closest('.overflow-y-auto') ||
                                    elementUnderMouse.closest('[class*="border-purple"]') ||
                                    elementUnderMouse.closest('*')?.querySelector('[placeholder*="Search lessons"]') ||
                                    // Check if it's within the UnassignedLessons card area
                                    !!elementUnderMouse.closest('div')?.textContent?.includes('Unassigned Lessons');
        
        if (isOverTrashZone || isOverUnassignedZone) {
          // Don't place in grid when dropped on special zones - let their handlers deal with it
          // Just clean up our state
          persistentDragState.current.isDragInProgress = false;
          persistentDragState.current.lessonId = null;
          persistentDragState.current.lessonDuration = null;
          persistentDragState.current.hasValidDragData = false;
          persistentDragState.current.lastValidPreview = null;
          persistentDragState.current.isProcessed = false; // Reset processed flag
          
          setDragPreview(null);
          setDraggedLesson(null);
          setIsActiveDrag(false);
          return;
        }
      }
      
      // Check if this drag operation has already been processed
      if (persistentDragState.current.isProcessed) {
        console.log("[TimeGrid] handleGlobalDragEnd - drag already processed, skipping");
        // Still need to clean up state
        persistentDragState.current.isDragInProgress = false;
        persistentDragState.current.lessonId = null;
        persistentDragState.current.lessonDuration = null;
        persistentDragState.current.hasValidDragData = false;
        persistentDragState.current.lastValidPreview = null;
        persistentDragState.current.isProcessed = false; // Reset processed flag
        
        setDragPreview(null);
        setDraggedLesson(null);
        setIsActiveDrag(false);
        return;
      }
      
      // Get current state values - use local state which has full lesson data
      const currentDragPreview = dragPreview;
      const currentDraggedLesson = draggedLesson;
      const persistentData = persistentDragState.current;
      
      // Use current preview if available, otherwise use persistent preview
      const previewToUse = currentDragPreview || persistentData.lastValidPreview;
      
      // Try to place lesson using either current state or persistent data
      const canPlaceWithCurrentState = isAdmin && previewToUse && currentDraggedLesson;
      const canPlaceWithPersistentState = isAdmin && previewToUse && persistentData.hasValidDragData;
      
      if (canPlaceWithCurrentState) {
        // Mark as processed to prevent duplicate handling
        persistentDragState.current.isProcessed = true;
        
        // Get the actual date from the weekDates array for the column where the lesson would be dropped
        const columnDate = weekDates[previewToUse.day];
        // Use calculated time from dragPreview and pass the actual date
        // Note: sourceDate is null for global drag operations since we don't track it
        onLessonDrop(currentDraggedLesson.id, previewToUse.day, previewToUse.time, columnDate, null);
      } else if (canPlaceWithPersistentState) {
        // Mark as processed to prevent duplicate handling
        persistentDragState.current.isProcessed = true;
        
        // Get the actual date from the weekDates array for the column where the lesson would be dropped
        const columnDate = weekDates[previewToUse.day];
        // Use calculated time from dragPreview and persistent lesson ID
        // Note: sourceDate is null for global drag operations since we don't track it
        onLessonDrop(persistentData.lessonId!, previewToUse.day, previewToUse.time, columnDate, null);
      }
      
      // Mark drag as finished and clean up persistent data
      persistentDragState.current.isDragInProgress = false;
      persistentDragState.current.lessonId = null;
      persistentDragState.current.lessonDuration = null;
      persistentDragState.current.hasValidDragData = false;
      persistentDragState.current.lastValidPreview = null;
      persistentDragState.current.isProcessed = false; // Reset processed flag
      
      // Reset states
      setDragPreview(null);
      setDraggedLesson(null);
      setIsActiveDrag(false);
    };

    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('dragend', handleGlobalDragEnd);
    document.addEventListener('drop', handleGlobalDragEnd);

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('drop', handleGlobalDragEnd);
    };
  }, [isAdmin, dragPreview, draggedLesson, weekDates, onLessonDrop]); // Add dependencies to prevent stale closures
  
  // Handle when something is dragged into our component (for unassigned lessons)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (isAdmin) {
      // We don't try to set dragged lesson here because the data isn't available yet
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleLessonClick = (e: React.MouseEvent, lessonId: string) => {
    if (editMode && isAdmin && onLessonClick) {
      e.preventDefault();
      e.stopPropagation();
      onLessonClick(lessonId);
    }
  };

  const renderDayColumn = (date: Date, dayIndex: number, isActuallyMobileDay: boolean) => {
    const lessonsOnThisDay = visibleLessons.filter(lesson => lesson.day === dayIndex);
    const isDayEmptyForStyling = lessonsOnThisDay.length === 0;

    return (
      <div key={dayIndex} className={`flex-1 min-w-[120px] ${isMobileView && !isAdmin && !isActuallyMobileDay ? 'hidden' : ''}`}>
        {/* Day Header: Only show for Desktop or Admin view */}
        {(!isMobileView || isAdmin) && (
            <div className="h-12 border-b border-gray-200 bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <div className="font-medium">{format(date, 'EEEE')}</div>
                <div className="text-xs text-gray-500">{format(date, 'MMM d')}</div>
              </div>
            </div>
        )}
        
        <div 
          className="relative day-column" 
          style={{ height: `${timeSlots.length * 48}px` }} 
          onDragEnter={handleDragEnter} 
          onDragOver={(e) => handleDragOver(e, dayIndex)} 
          onDragLeave={handleDragLeave} 
          onDrop={(e) => handleDrop(e, dayIndex)}
        >
          {timeSlots.map((_, timeIndex) => (
                <div 
                  key={timeIndex}
              className={`h-12 border-gray-200 
                          ${(isDayEmptyForStyling && !isAdmin) 
                            ? 'bg-gray-200 border-gray-300' // User's adjusted darker gray for empty teacher days
                            : (timeIndex % 2 === 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200')} 
                          ${timeIndex % 2 === 0 ? 'border-t-2 border-gray-300' : 'border-t border-gray-200'}
                          ${timeIndex === timeSlots.length - 1 ? 'border-b-2 border-gray-200' : ''}
                        `}
                />
              ))}
              
          {dragPreview && dragPreview.day === dayIndex && (
             <>
               {/* Show original position if repositioned due to collision */}
               {dragPreview.isRepositioned && (
                 <div
                   className="absolute collision-indicator"
                   style={getOriginalPositionStyle()}
                   title="Can't place here - lesson would overlap"
                 />
               )}
               {/* Main preview showing valid position */}
               <div
                 className="absolute"
                 style={getDragPreviewStyle()}
                 title={dragPreview.isRepositioned ? "Closest available position" : ""}
               />
             </>
           )}
           
           {visibleLessons.filter(lesson => lesson.day === dayIndex).map(lesson => {
                  const style = getLessonStyle(lesson);
                  const subject = getSubjectById(lesson.subject_id);
             const color = subject?.color || '#9b87f5';
                  
                  return (
                    <div
                      key={lesson.id}
                 className={`absolute rounded-lg shadow-sm px-2 py-1 hover:shadow-md transition-shadow flex flex-col justify-center ${editMode ? 'hover:brightness-95' : ''}`}
                      style={style}
                 draggable={isAdmin && !editMode}
                 onClick={(e) => handleLessonClick(e, lesson.id)}
                      onDragStart={(e) => {
                   if (isAdmin && !editMode) {
                     // Reset processed flag for new drag operation
                     persistentDragState.current.isProcessed = false;
                     
                     try {
                       // Store ID in the dataTransfer to maintain compatibility with existing code
                          e.dataTransfer.setData("lesson", lesson.id);
                       
                       // Also store the duration directly in dataTransfer
                       e.dataTransfer.setData("lessonDuration", lesson.duration.toString());
                       
                       // IMPORTANT: Store the source day to know where the lesson was dragged from
                       e.dataTransfer.setData("sourceDayIndex", dayIndex.toString());
                       
                       // Set the full dragged lesson info in state (this is the important part)
                       setDraggedLesson({
                         id: lesson.id,
                         duration: lesson.duration
                       });
                     } catch (error) {
                       console.error('[TimeGrid] onDragStart: Error setting data transfer:', error);
                     }
                     
                          e.dataTransfer.effectAllowed = "move";
                          
                     // Create custom drag image matching UnassignedLessons style
                          const dragElement = document.createElement('div');
                     dragElement.className = 'fixed w-32 px-2 py-1 rounded-lg shadow flex flex-col justify-center';
                     dragElement.style.backgroundColor = getLighterColor(color);
                     dragElement.style.borderLeft = `4px solid ${color}`;
                          dragElement.style.pointerEvents = 'none';
                          dragElement.style.top = '-1000px';
                          dragElement.style.left = '0';
                          const nameElement = document.createElement('div');
                     nameElement.className = 'font-medium truncate text-gray-800 text-sm';
                          nameElement.textContent = lesson.student_name;
                          const infoElement = document.createElement('div');
                     infoElement.className = 'text-xs text-gray-600';
                          infoElement.textContent = `${subject?.name} (${lesson.duration} min)`;
                          dragElement.appendChild(nameElement);
                          dragElement.appendChild(infoElement);
                          document.body.appendChild(dragElement);
                          e.dataTransfer.setDragImage(dragElement, 20, 20);
                          setTimeout(() => {
                            document.body.removeChild(dragElement);
                          }, 0);
                        }
                      }}
                 onDragEnd={(_) => {
                   setDraggedLesson(null);
                   setDragPreview(null);
                      }}
                    >
                 <div className="font-medium truncate text-gray-800 text-sm">{lesson.student_name}</div>
                 <div className="text-xs text-gray-600">
                        {subject?.name} ({lesson.duration} min)
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden relative">
      <div className="flex">
        {/* Time column - always visible */}
        <div className="w-28 shrink-0 z-10 bg-white">
          {/* Only render this empty header cell in desktop view or admin view */}
          {(!isMobileView || isAdmin) && (
            <div className="h-12 border-b border-r border-gray-200 bg-gray-50"></div>
          )}
          {timeSlots.map((slotStartTime, index) => {
            let endTimeString;
            if (index < timeSlots.length - 1) {
              endTimeString = timeSlots[index + 1];
            } else {
              // Last slot's end time is the grid's visual end time
              endTimeString = `${gridVisualEndHour.toString().padStart(2, '0')}:${gridVisualEndMinute.toString().padStart(2, '0')}`;
            }
            const displayTime = `${slotStartTime} - ${endTimeString}`;
            return (
              <div 
                key={index} 
                className={`h-12 border-r border-gray-200 px-2 py-1 flex items-center text-sm 
                            ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                            ${index % 2 === 0 ? 'border-t-2 border-gray-300' : 'border-t border-gray-200'}
                            ${index === timeSlots.length - 1 ? 'border-b-2 border-gray-300' : ''} 
                          `}
              >
                {displayTime}
              </div>
            );
          })}
        </div>
        
        {/* Days columns - conditional rendering based on view */}
        {isMobileView && !isAdmin ? (
          renderDayColumn(weekDates[mobileSelectedDayIndex], mobileSelectedDayIndex, true)
        ) : (
          weekDates.map((date, dayIndex) => renderDayColumn(date, dayIndex, false))
        )}
      </div>
    </div>
  );
};

export default TimeGrid;
