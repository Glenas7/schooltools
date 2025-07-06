export type UserRole = 'admin' | 'teacher' | 'superadmin';

// User type for the users table
export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  last_accessed_school_id?: string;
  created_at: string;
  updated_at: string;
}

// School type for the schools table
export interface School {
  id: string;
  name: string;
  description?: string;
  google_sheet_url?: string;
  google_sheet_name?: string;
  google_sheet_range?: string;
  google_sheet_lessons_url?: string;
  google_sheet_lessons_name?: string;
  google_sheet_lessons_range?: string;
  export_google_sheet_url?: string;
  export_google_sheet_tab?: string;
  auto_export_frequency?: 'none' | 'hourly' | 'daily' | 'weekly';
  join_code: string;
  school_year_end_date?: string; // YYYY-MM-DD format
  settings?: Record<string, any>;
  active: boolean;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

// User-School relationship type
export interface UserSchool {
  id: string;
  user_id: string;
  school_id: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// School with role information for current user
export interface SchoolWithRole extends School {
  userRole: UserRole;
}

// Type for creating a new school
export interface CreateSchoolData {
  name: string;
  description?: string;
  google_sheet_url?: string;
}

// Subject type (renamed from Instrument)
export interface Subject {
  id: string;
  school_id: string;
  name: string;
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Teacher type with school context
export interface Teacher extends User {
  school_id: string;
  subjectIds: string[];
}

// Lesson type with school context
export interface Lesson {
  id: string;
  school_id: string;
  student_name: string;
  duration: number;
  teacher_id: string | null;
  day: number | null; // 0 = Monday, 1 = Tuesday, etc.
  start_time: string | null; // HH:MM format
  subject_id: string;
  start_date: string | null; // YYYY-MM-DD format
  end_date: string | null; // YYYY-MM-DD format
  created_at: string;
  updated_at: string;
}

export type LessonUnsaved = Omit<Lesson, 'id' | 'created_at' | 'updated_at'>;

// Location type
export interface Location {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Note: LessonLocation table has been removed in favor of location_id field in lessons table

// Lesson with location information
export interface LessonWithLocation extends Lesson {
  location?: Location | null;
}

// Context types
export interface SchoolContextType {
  currentSchool: School | null;
  userRole: UserRole | null;
  isSchoolAdmin: boolean;
  isSchoolSuperAdmin: boolean;
  setCurrentSchool: (school: School | null) => void;
  switchSchool: (schoolId: string) => void;
  refreshSchool: () => Promise<void>;
}
