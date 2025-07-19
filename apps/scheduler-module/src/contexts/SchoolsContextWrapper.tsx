import React from 'react';
import { SchoolsProvider as SharedSchoolsProvider, useSchools as useSharedSchools } from '@schooltools/shared-auth';
import { supabase } from '../lib/supabaseClient';

// Backwards-compatible wrapper for the shared SchoolsProvider
export const SchoolsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SharedSchoolsProvider supabaseClient={supabase}>
      {children}
    </SharedSchoolsProvider>
  );
};

// Re-export the useSchools hook with the same interface
export const useSchools = useSharedSchools;

export default SchoolsProvider; 