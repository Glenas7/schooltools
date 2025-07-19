export type UserRole = 'admin' | 'teacher' | 'superadmin';

// Enhanced User type that extends current User with module preferences
export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  last_accessed_school_id?: string;
  last_accessed_module?: string;    // Module preference tracking
  preferences?: Record<string, any>; // Additional user preferences
  created_at: string;
  updated_at: string;
}

// School type (join_code removed as not needed for targeted applications)
export interface School {
  id: string;
  name: string;
  description?: string;
  slug: string;
  google_sheet_url?: string;
  google_sheet_name?: string;
  google_sheet_range?: string;
  google_sheet_lessons_url?: string;
  google_sheet_lessons_name?: string;
  google_sheet_lessons_range?: string;
  export_google_sheet_url?: string;
  export_google_sheet_tab?: string;
  auto_export_frequency?: 'none' | 'hourly' | 'daily' | 'weekly';
  export_active_lessons_only?: boolean;
  export_schedule_time?: string; // HH:MM:SS format
  export_schedule_day?: number; // 1=Monday, 7=Sunday
  export_timezone?: string; // Timezone string (e.g., 'Europe/Madrid', 'America/New_York')
  school_year_end_date?: string; // YYYY-MM-DD format
  settings?: Record<string, any>;
  active: boolean;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

// User-School relationship type (legacy - for backward compatibility)
export interface UserSchool {
  id: string;
  user_id: string;
  school_id: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Module types for the new module management system
export interface Module {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  subdomain: string;
  role_hierarchy: string[];
  default_role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserModulePermission {
  module_id: string;
  module_name: string;
  module_display_name: string;
  module_icon?: string; // Icon emoji from modules table
  module_subdomain?: string; // Subdomain from modules table
  user_role: string;
  role_hierarchy: string[];
}

export interface ModuleUser {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  granted_by?: string;
  granted_at?: string;
}

// Enhanced school with role information for current user (includes module data)
export interface SchoolWithRole extends School {
  userRole: UserRole; // Legacy role from user_schools
  is_superadmin?: boolean; // New superadmin flag
  modules?: UserModulePermission[]; // User's module permissions for this school
}

// Type for creating a new school (unchanged)
export interface CreateSchoolData {
  name: string;
  description?: string;
  google_sheet_url?: string;
}

// AuthContext interface (updated to match AuthProvider implementation)
export interface AuthContextType {
  user: User | null;
  session: any | null; // Add session property
  isAuthenticated: boolean;
  isAdmin: boolean; // Add isAdmin property
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>; // Add forgotPassword function
  resetPassword: (token: string, password: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>; // Add updatePassword
  updateLastAccessedSchool: (schoolId: string) => Promise<void>;
  updateLastAccessedModule: (moduleId: string) => Promise<void>; // Add updateLastAccessedModule
}

// SchoolsContext interface (enhanced with module support, join functionality removed)
export interface SchoolsContextType {
  schools: SchoolWithRole[];
  loading: boolean;
  error: Error | null;
  fetchUserSchools: () => Promise<void>;
  createSchool: (schoolData: CreateSchoolData) => Promise<School | null>;
  updateSchool: (schoolId: string, updates: Partial<School>) => Promise<School | null>;
  deleteSchool: (schoolId: string) => Promise<boolean>;
  canDeleteSchool: (schoolId: string) => Promise<boolean>;
}

// SchoolContext interface with module support
export interface SchoolContextType {
  currentSchool: School | null;
  userRole: UserRole | null;
  loading: boolean;
  isSchoolAdmin: boolean;
  isSchoolSuperAdmin: boolean;
  setCurrentSchool: (school: School | null) => Promise<void>;
  switchSchool: (schoolId: string) => Promise<void>;
  refreshSchool: () => Promise<void>;
}

// Module management context types
export interface ModulesContextType {
  modules: Module[];
  loading: boolean;
  error: Error | null;
  fetchModules: () => Promise<void>;
  getUserModulesForSchool: (schoolId: string) => Promise<UserModulePermission[]>;
  getModuleUsersForSchool: (schoolId: string, moduleId: string) => Promise<ModuleUser[]>;
  grantModuleAccess: (userId: string, schoolId: string, moduleId: string, role: string) => Promise<boolean>;
  revokeModuleAccess: (userId: string, schoolId: string, moduleId: string) => Promise<boolean>;
  canManageModulePermissions: (schoolId: string, moduleId: string) => Promise<boolean>;
  hasModuleAccess: (schoolId: string, moduleName: string) => Promise<boolean>;
  getUserModuleRole: (schoolId: string, moduleName: string) => Promise<string | null>;
} 

// Redirect logic types
export interface UserModulePermissions {
  [schoolId: string]: {
    [moduleId: string]: {
      active: boolean;
      role: string;
    };
  };
}

export interface RedirectDestination {
  type: 'school_setup' | 'module_selection' | 'direct_module' | 'school_selection';
  url: string;
  schoolId?: string;
  moduleId?: string;
} 