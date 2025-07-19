import { User, SchoolWithRole, UserModulePermissions, RedirectDestination } from '../types';

// Smart redirect logic that determines where users should go after login
export async function determinePostLoginRedirect(
  user: User,
  schools: SchoolWithRole[],
  modulePermissions: UserModulePermissions = {}
): Promise<RedirectDestination> {
  
  // No schools - setup required
  if (schools.length === 0) {
    return {
      type: 'school_setup',
      url: 'https://app.schooltools.online/school-setup'
    };
  }

  const lastSchool = user.last_accessed_school_id;
  const lastModule = user.last_accessed_module;
  const hasAccessToLastSchool = schools.find(s => s.id === lastSchool);

  // User has preferred school + module + access
  if (lastSchool && lastModule && hasAccessToLastSchool) {
    const hasModuleAccess = modulePermissions[lastSchool]?.[lastModule]?.active;
    
    if (hasModuleAccess) {
      return {
        type: 'direct_module',
        url: `https://${lastModule}.schooltools.online?school=${lastSchool}`,
        schoolId: lastSchool,
        moduleId: lastModule
      };
    }
  }

  // User has preferred school but no/invalid module preference
  if (lastSchool && hasAccessToLastSchool) {
    return {
      type: 'module_selection',
      url: `https://app.schooltools.online?school=${lastSchool}`,
      schoolId: lastSchool
    };
  }

  // Single school - go to module selection for that school
  if (schools.length === 1) {
    return {
      type: 'module_selection',
      url: `https://app.schooltools.online?school=${schools[0].id}`,
      schoolId: schools[0].id
    };
  }

  // Multiple schools - let user choose
  return {
    type: 'school_selection',
    url: 'https://app.schooltools.online'
  };
}

// Fallback redirect logic for current single-module usage (backwards compatible)
export function determineSingleModuleRedirect(
  user: User,
  schools: SchoolWithRole[],
  currentModulePath: string = '/schedule'
): RedirectDestination {
  
  if (schools.length === 0) {
    return {
      type: 'school_setup',
      url: '/school-select'
    };
  }

  const lastSchool = user.last_accessed_school_id;
  const hasAccessToLastSchool = schools.find(s => s.id === lastSchool);

  // User has a last accessed school and it's still available, redirect there
  if (lastSchool && hasAccessToLastSchool) {
    return {
      type: 'direct_module',
      url: `/school/${lastSchool}${currentModulePath}`,
      schoolId: lastSchool
    };
  }

  // Single school - go directly to that school
  if (schools.length === 1) {
    return {
      type: 'direct_module',
      url: `/school/${schools[0].id}${currentModulePath}`,
      schoolId: schools[0].id
    };
  }

  // Multiple schools and no valid last accessed school, let them choose
  return {
    type: 'school_selection',
    url: '/school-select'
  };
} 