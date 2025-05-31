import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSubjects } from '../../contexts/SubjectsContext';
import { useSchool } from '../../contexts/SchoolContext';
import { useLessons } from '../../contexts/LessonsContext';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTeachers } from '../../contexts/TeachersContext';
import { useStudentNames } from '@/hooks/useStudentNames';
import { useResponsiveValue } from '@/hooks/useResponsiveValue';
import { Subject } from '../../types';

// Create a context to access the selected teacher ID from Schedule component
export const SelectedTeacherContext = React.createContext<string>('');

// Define CSS for subject buttons
const subjectButtonStyles = {
  button: `
    flex items-center justify-center
    w-[70px] h-[70px]
    rounded-lg
    text-white font-medium
    cursor-pointer
    transition-all duration-200
    relative overflow-hidden
    hover:transform hover:scale-105
    hover:shadow-md
  `,
  nameContainer: `
    text-center
    p-1
    w-full
    leading-tight
    overflow-hidden
    hyphens-auto
    word-break-words
  `,
  // More granular text sizes for better fitting
  tiny: `text-[0.45rem] leading-[0.55rem]`,      // Smallest for very long names
  extraSmall: `text-[0.55rem] leading-[0.65rem]`, // Extra small for long names
  small: `text-[0.65rem] leading-[0.75rem]`,     // Small for medium-long names
  medium: `text-[0.75rem] leading-[0.85rem]`,    // Medium for medium names
  large: `text-[0.85rem] leading-[0.95rem]`,     // Large for short names
  extraLarge: `text-[0.9rem] leading-[1rem]`     // Largest for very short names
};

// Mock student names as a fallback
const MOCK_STUDENT_NAMES = [
  "Alice Smith",
  "Bob Johnson",
  "Charlie Williams",
  "David Brown",
  "Eva Jones",
  "Frank Miller",
  "Grace Davis",
  "Henry Wilson",
  "Iris Moore",
  "Jack Taylor",
  "Kate Anderson",
  "Leo Thomas",
  "Mia Jackson",
  "Noah White",
  "Olivia Harris",
  "Peter Martin",
  "Quinn Lee",
  "Ryan Thompson",
  "Sophia Clark",
  "Tyler Lewis"
];

const NewLessonForm = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [duration, setDuration] = useState(30);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const { subjects } = useSubjects();
  const { createLesson } = useLessons();
  const { teachers } = useTeachers();
  const { currentSchool } = useSchool();
  
  // Access the selected teacher ID from context
  const selectedTeacherId = useContext(SelectedTeacherContext);

  // State for autocomplete
  const { studentNames: allStudentNames, isLoading: isLoadingStudentNames } = useStudentNames();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const studentNameInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLUListElement>(null);
  const visibleSubjectsCount = useResponsiveValue({
    desktop: 4,
    tablet: 3, 
    mobile: 2
  });

  const [unassignedSubjects, setUnassignedSubjects] = useState<Subject[]>([]);
  
  // Helper function to normalize strings (remove accents)
  const normalizeString = (str: string): string => {
    return str
      .normalize('NFD')                    // Normalize to decomposed form
      .replace(/[\u0300-\u036f]/g, '');    // Remove combining diacritical marks
  };
  
  // Helper function to determine appropriate text size based on subject name length
  const getTextSizeClass = (nameLength: number): string => {
    if (nameLength > 14) return 'tiny';        // Very long names get tiniest font
    if (nameLength > 11) return 'extraSmall';  // Long names get extra small font
    if (nameLength > 9) return 'small';        // Medium-long names get small font
    if (nameLength > 7) return 'medium';       // Medium names get medium font
    if (nameLength > 5) return 'large';        // Short names get large font
    return 'extraLarge';                       // Very short names get largest font
  };
  
  // Get the teacher's subjects
  const teacherSubjectIds = useMemo(() => {
    if (!selectedTeacherId) return [];
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    return teacher?.subjectIds || [];
  }, [selectedTeacherId, teachers]);
  
  // Find subjects not assigned to any teacher (generic subjects)
  const genericSubjects = useMemo(() => {
    // Get all subject IDs assigned to any teacher
    const allAssignedSubjectIds = new Set<string>();
    teachers.forEach(teacher => {
      teacher.subjectIds?.forEach(id => allAssignedSubjectIds.add(id));
    });
    
    // Filter subjects to find those not assigned to any teacher
    return subjects.filter(subject => !allAssignedSubjectIds.has(subject.id));
  }, [subjects, teachers]);
  
  // Filter subjects to show both teacher's subjects and unassigned subjects
  const filteredSubjects = useMemo(() => {
    if (!teacherSubjectIds.length && !genericSubjects.length) return [];
    
    // Combine teacher-specific and unassigned subjects
    const combinedSubjects = [
      ...subjects.filter(subject => teacherSubjectIds.includes(subject.id)),
      ...genericSubjects
    ];
    
    // Remove duplicates (in case there's overlap)
    const uniqueSubjectIds = new Set<string>();
    return combinedSubjects.filter(subject => {
      if (uniqueSubjectIds.has(subject.id)) return false;
      uniqueSubjectIds.add(subject.id);
      return true;
    });
  }, [subjects, teacherSubjectIds, genericSubjects]);
  
  // Check if teacher has only one subject
  const hasOnlyOneSubject = useMemo(() => {
    return filteredSubjects.length === 1;
  }, [filteredSubjects]);
  
  // Reset startIndex when filtered subjects change
  useEffect(() => {
    setStartIndex(0);
  }, [filteredSubjects]);
  
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
        setSelectedIndex(-1);
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
  
  // Handle duration input keydown (Enter should behave like clicking duration buttons when one subject)
  const handleDurationInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hasOnlyOneSubject && filteredSubjects.length === 1) {
      e.preventDefault();
      setSelectedSubjectId(filteredSubjects[0].id);
      setIsDialogOpen(true);
    }
  };
  
  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    
    // If teacher has only one subject, open the dialog directly
    if (hasOnlyOneSubject && filteredSubjects.length === 1) {
      setSelectedSubjectId(filteredSubjects[0].id);
      setIsDialogOpen(true);
    }
  };
  
  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setIsDialogOpen(true);
  };

  // Add keyboard navigation for autocomplete
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter key when autocomplete is closed - submit the form
    if (e.key === 'Enter' && !isAutocompleteOpen) {
      e.preventDefault();
      if (selectedSubjectId && studentName.trim()) {
        handleCreateLesson();
      }
      return;
    }

    if (!isAutocompleteOpen || suggestions.length === 0) return;

    // Down arrow
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => {
        const newIndex = prev < suggestions.length - 1 ? prev + 1 : 0;
        
        // Scroll the selected item into view if needed
        if (autocompleteRef.current) {
          const listItems = autocompleteRef.current.querySelectorAll('li');
          if (listItems[newIndex]) {
            listItems[newIndex].scrollIntoView({ block: 'nearest' });
          }
        }
        
        return newIndex;
      });
    }
    
    // Up arrow
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => {
        const newIndex = prev > 0 ? prev - 1 : suggestions.length - 1;
        
        // Scroll the selected item into view if needed
        if (autocompleteRef.current) {
          const listItems = autocompleteRef.current.querySelectorAll('li');
          if (listItems[newIndex]) {
            listItems[newIndex].scrollIntoView({ block: 'nearest' });
          }
        }
        
        return newIndex;
      });
    }
    
    // Enter key
    else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[selectedIndex]);
    }
  };

  const handleStudentNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStudentName(value);
    
    if (value.length > 0 && allStudentNames.length > 0) {
      // Normalize the input value
      const normalizedValue = normalizeString(value.toLowerCase());
      
      // Filter student names by comparing normalized versions
      const filtered = allStudentNames.filter(name => 
        normalizeString(name.toLowerCase()).includes(normalizedValue)
      );
      
      setSuggestions(filtered);
      
      // Open autocomplete and pre-select the first item if there are matches
      if (filtered.length > 0) {
        setIsAutocompleteOpen(true);
        setSelectedIndex(0); // Pre-select the first item
      } else {
        setIsAutocompleteOpen(false);
        setSelectedIndex(-1);
      }
    } else {
      setSuggestions([]);
      setIsAutocompleteOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (name: string) => {
    setStudentName(name);
    setSuggestions([]);
    setIsAutocompleteOpen(false);
    setSelectedIndex(-1);
  };
  
  const handleCreateLesson = () => {
    if (selectedSubjectId && studentName.trim()) {
      createLesson({
        student_name: studentName.trim(),
        duration,
        teacher_id: null,
        day: null,
        start_time: null,
        subject_id: selectedSubjectId,
        start_date: null,
        end_date: null,
        school_id: currentSchool.id,
        active: true
      }, selectedTeacherId);
      
      setIsDialogOpen(false);
      setStudentName('');
      setSelectedSubjectId(null);
      setIsAutocompleteOpen(false);
    }
  };
  
  const getDisplayedSubjects = () => {
    if (!filteredSubjects || filteredSubjects.length === 0) {
      return [];
    }
    const numSubjects = filteredSubjects.length;
    const display = [];
    for (let i = 0; i < Math.min(visibleSubjectsCount, numSubjects); i++) {
      display.push(filteredSubjects[(startIndex + i) % numSubjects]);
    }
    return display;
  };
  const displayedSubjects = getDisplayedSubjects();

  const nextSubject = () => {
    if (!filteredSubjects || filteredSubjects.length === 0) return;
    setStartIndex((prevIndex) => (prevIndex + 1) % filteredSubjects.length);
  };

  const prevSubject = () => {
    if (!filteredSubjects || filteredSubjects.length === 0) return;
    setStartIndex((prevIndex) => (prevIndex - 1 + filteredSubjects.length) % filteredSubjects.length);
  };

  // Show a message if no subjects are available for the selected teacher
  const noSubjectsMessage = !filteredSubjects.length && selectedTeacherId 
    ? "No subjects available for this teacher" 
    : "Select a teacher to see subjects";

  return (
    <div className="mb-6 bg-white rounded-lg shadow p-4">
      <Popover open={isFormOpen} onOpenChange={setIsFormOpen}>
        <PopoverTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Create New Lesson
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-4">
          <div className="space-y-4">
            <h3 className="font-medium">Create a New Lesson</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Lesson Duration</label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min={15}
                  max={90}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(15, Math.min(90, parseInt(e.target.value) || 30)))}
                  className="w-20"
                  onKeyDown={handleDurationInputKeyDown}
                />
                <span className="text-sm text-gray-500">minutes</span>
                <div className="flex space-x-1 ml-2">
                  {[30, 45, 60].map((mins) => (
                    <Button
                      key={mins}
                      variant={duration === mins ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleDurationChange(mins)}
                    >
                      {mins}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Subject</label>
              {filteredSubjects.length > 0 ? (
                <div className="relative flex items-center">
                  {filteredSubjects.length > visibleSubjectsCount && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="absolute left-0 z-10"
                      onClick={prevSubject}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div 
                    className={`flex w-full overflow-hidden ${
                      filteredSubjects.length > visibleSubjectsCount 
                        ? "px-12 justify-between" 
                        : "justify-center"
                    }`}
                  >
                    {displayedSubjects.map((subject, index) => {
                      // Get appropriate text size class for the subject name
                      const textSizeClass = getTextSizeClass(subject.name.length);
                          
                      return (
                        <button
                          key={subject.id}
                          className={`${subjectButtonStyles.button} ${
                            filteredSubjects.length <= visibleSubjectsCount 
                              ? "mx-3" 
                              : ""
                          }`}
                          style={{ backgroundColor: subject.color }}
                          onClick={() => handleSubjectSelect(subject.id)}
                        >
                          <span 
                            className={`${subjectButtonStyles.nameContainer} ${
                              subjectButtonStyles[textSizeClass as keyof typeof subjectButtonStyles]
                            }`}
                          >
                            {subject.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  
                  {filteredSubjects.length > visibleSubjectsCount && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="absolute right-0 z-10"
                      onClick={nextSubject}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">{noSubjectsMessage}</div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setIsAutocompleteOpen(false);
          setStudentName('');
          setSuggestions([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Information</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (selectedSubjectId && studentName.trim()) {
              handleCreateLesson();
            }
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2 relative">
                <label htmlFor="student-name" className="text-sm font-medium">
                  Student Name
                </label>
                <Input
                  id="student-name"
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
                    className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto dark:bg-gray-950 dark:border-gray-800">
                    {suggestions.map((name, index) => (
                      <li
                        key={index}
                        className={`px-3 py-2 ${
                          selectedIndex === index 
                            ? 'bg-blue-100 dark:bg-blue-900' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        } cursor-pointer text-sm`}
                        onMouseEnter={() => setSelectedIndex(index)}
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
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0 w-8 h-8 rounded" style={{ 
                  backgroundColor: subjects.find(i => i.id === selectedSubjectId)?.color || '#9b87f5' 
                }}></div>
                <div>
                  <div className="font-medium">
                    {subjects.find(i => i.id === selectedSubjectId)?.name}
                  </div>
                  <div className="text-sm text-gray-500">{duration} minutes</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setIsAutocompleteOpen(false);
                setStudentName('');
                setSuggestions([]);
              }}>
                Cancel
              </Button>
              <Button type="submit">Create Lesson</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewLessonForm;
