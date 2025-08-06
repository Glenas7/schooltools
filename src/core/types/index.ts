// Core types for the school scheduler application

export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_accessed_school_id?: string; // For backward compatibility
}

export type UserRole = 'admin' | 'teacher' | 'superadmin';

export interface School {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  google_sheet_url?: string;
  google_sheet_name?: string; // For backward compatibility
  google_sheet_range?: string;
  google_sheet_lessons_url?: string;
  google_sheet_lessons_name?: string;
  google_sheet_lessons_range?: string;
  school_year_end_date?: string;
  export_google_sheet_url?: string;
  export_google_sheet_tab?: string;
  auto_export_frequency?: string;
  export_active_lessons_only?: boolean;
  export_schedule_time?: string;
  export_schedule_day?: string;
  export_timezone?: string;
  last_export_at?: string;
  settings?: Record<string, any>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolWithRole extends School {
  role: UserRole;
  userRole: UserRole; // Alias for backward compatibility
  modules?: Module[];
}

export interface UserSchool {
  user_id: string;
  school_id: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface CreateSchoolData {
  name: string;
  description?: string;
  slug?: string;
  google_sheet_url?: string;
}

export interface Module {
  id: string;
  module_id: string; // Alias for id for backward compatibility
  module_name: string;
  display_name: string;
  module_display_name: string; // Alias for display_name
  description?: string;
  icon?: string;
  module_icon?: string; // Alias for icon
  active: boolean;
  user_role?: string; // User's role for this module
}

export interface ModulesContextType {
  modules: Module[];
  loading: boolean;
  error: string | null;
  getUserModulesForSchool: (schoolId: string) => Promise<Module[]>;
  getModuleUsersForSchool: (schoolId: string, moduleId: string) => Promise<any[]>;
  grantModuleAccess: (userId: string, schoolId: string, moduleId: string, role: string) => Promise<{ success: boolean }>;
  revokeModuleAccess: (userId: string, schoolId: string, moduleId: string) => Promise<{ success: boolean }>;
}

// Context types
export interface AuthContextType {
  user: User | null;
  session: any;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout?: () => Promise<void>; // Alias for backward compatibility
  updateLastAccessedSchool?: (schoolId: string) => Promise<void>; // For backward compatibility
  forgotPassword?: (email: string) => Promise<void>; // For backward compatibility
}

export interface SchoolContextType {
  currentSchool: School | null;
  userRole: UserRole | null;
  loading: boolean;
  error: string | null;
  refreshSchool: () => Promise<void>;
  setCurrentSchool: (school: School | null) => void;
  isSchoolAdmin: boolean;
}

export interface SchoolsContextType {
  schools: SchoolWithRole[];
  loading: boolean;
  error: string | null;
  refreshSchools: () => Promise<void>;
  createSchool: (data: CreateSchoolData) => Promise<School>;
  updateSchool: (id: string, data: Partial<School>) => Promise<void>;
  deleteSchool: (id: string) => Promise<{ success: boolean; message?: string }>;
  fetchUserSchools?: () => Promise<void>;
  canDeleteSchool?: (schoolId: string) => Promise<boolean>;
}