import React from 'react';
import { AuthProvider as SharedAuthProvider, useAuth as useSharedAuth } from '@schooltools/shared-auth';
import { supabase } from '../lib/supabaseClient';

// Backwards-compatible wrapper for the shared AuthProvider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SharedAuthProvider supabaseClient={supabase}>
      {children}
    </SharedAuthProvider>
  );
};

// Re-export the useAuth hook with the same interface
export const useAuth = useSharedAuth;

export default AuthProvider; 