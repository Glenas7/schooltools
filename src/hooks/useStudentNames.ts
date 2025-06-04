import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useSchool } from '../contexts/SchoolContext';

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

// Function to fetch student names from the Supabase Edge Function
const fetchStudentNames = async (schoolId: string | null): Promise<string[]> => {
  try {
    // If no school is selected, return mock data
    if (!schoolId) {
      return MOCK_STUDENT_NAMES;
    }
    
    // Call the Edge Function with school_id
    const { data, error } = await supabase.functions.invoke('public-get-students', {
      body: { school_id: schoolId }
    });
    
    if (error) {
      return MOCK_STUDENT_NAMES;
    }
    
    // Handle the response based on its structure
    if (data && Array.isArray(data)) {
      return data;
    } else if (data && data.students && Array.isArray(data.students)) {
      return data.students;
    } else {
      return MOCK_STUDENT_NAMES;
    }
  } catch (error) {
    return MOCK_STUDENT_NAMES;
  }
};

export function useStudentNames() {
  const { currentSchool } = useSchool();
  
  // Use React Query to fetch and cache student names
  const { data: studentNames, isLoading, isError } = useQuery({
    queryKey: ['studentNames', currentSchool?.id],
    queryFn: () => fetchStudentNames(currentSchool?.id || null),
    staleTime: 1000 * 60 * 60, // 1 hour - data considered fresh for an hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache for a day
    enabled: !!currentSchool, // Only run when we have a current school
  });
  
  return {
    studentNames: studentNames || MOCK_STUDENT_NAMES,
    isLoading,
    isError,
  };
}

export default useStudentNames; 