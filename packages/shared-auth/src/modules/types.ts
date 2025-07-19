// Module-related types for future expansion
// These will be used when we implement Phase 2 (Central Hub)

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  subdomain: string;
  icon: string;
  active: boolean;
}

export interface ModuleAccessRequest {
  schoolId: string;
  moduleId: string;
  userId: string;
  role: 'admin' | 'user' | 'viewer';
}

// Placeholder for future module provider
export interface ModuleProviderProps {
  children: React.ReactNode;
  supabaseClient: any;
}

// Export an empty object for now to avoid import errors
export const moduleHelpers = {}; 