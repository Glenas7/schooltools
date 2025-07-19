// Auth exports
export { AuthProvider, useAuth } from './auth/AuthProvider';

// School exports  
export { SchoolProvider, useSchool } from './school/SchoolProvider';
export { SchoolsProvider, useSchools } from './school/SchoolsProvider';

// Module exports (NEW)
export { ModulesProvider, useModules } from './modules/ModulesProvider';

// Navigation exports
export { 
  navigateToModule, 
  navigateToCentralHub, 
  getCurrentSubdomain, 
  getModuleDisplayName 
} from './navigation/moduleNavigation';

// Storage exports
export { CrossDomainStorage } from './storage/crossDomainStorage';

// School sync exports
export { 
  syncSchoolAcrossApps, 
  getCurrentSchoolFromSync, 
  clearSchoolSync 
} from './school/schoolSync';

// Type exports
export type {
  User,
  UserRole,
  School,
  SchoolWithRole,
  UserSchool,
  CreateSchoolData,
  AuthContextType,
  SchoolContextType,
  SchoolsContextType,
  // Module types (NEW)
  Module,
  UserModulePermission,
  ModuleUser,
  ModulesContextType
} from './types'; 