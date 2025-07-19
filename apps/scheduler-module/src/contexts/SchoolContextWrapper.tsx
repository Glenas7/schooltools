import React from 'react';
import { SchoolProvider as SharedSchoolProvider, useSchool as useSharedSchool } from '@schooltools/shared-auth';
import { supabase } from '../lib/supabaseClient';

// Backwards-compatible wrapper for the shared SchoolProvider
export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SharedSchoolProvider supabaseClient={supabase}>
      {children}
    </SharedSchoolProvider>
  );
};

// Re-export the useSchool hook with the same interface
export const useSchool = useSharedSchool;

export default SchoolProvider; 