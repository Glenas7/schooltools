import React, { createContext, useState, useContext, useEffect } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/core/lib/supabaseClient';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // If user doesn't exist in users table, create a basic profile from auth user
        if (error.code === 'PGRST116') {
  
          return {
            id: authUser.id,
            email: authUser.email,
            created_at: authUser.created_at,
            updated_at: new Date().toISOString()
          };
        }
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      return null;
    }
  };

  const handleAuthStateChange = async (event: string, currentSession: Session | null) => {

    setSession(currentSession);

    try {
      if (currentSession?.user) {
        // Add a small delay to ensure auth.uid() is available in RLS context
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const profile = await fetchUserProfile(currentSession.user);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error in handleAuthStateChange:', error);
      setUser(null);
    } finally {
      // Always set loading to false, regardless of success or failure
      setLoading(false);
    }
  };

  useEffect(() => {
    
    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('[AuthContext] Auth loading timeout - forcing loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {

      clearTimeout(timeoutId); // Clear timeout on successful session fetch
      handleAuthStateChange('INITIAL_SESSION', session);
    }).catch((error) => {
      console.error('[AuthContext] Error getting initial session:', error);
      clearTimeout(timeoutId);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

      handleAuthStateChange(event, session);
    });

    return () => {

      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // User profile will be fetched automatically via the auth state change handler
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    if (session?.user) {
      const profile = await fetchUserProfile(session.user);
      setUser(profile);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    login,
    signOut,
    refreshUser,
    logout: signOut, // Alias for backward compatibility
    updateLastAccessedSchool: async (schoolId: string) => {
      if (!user) {
        console.warn('[AuthContext] Cannot update last accessed school - no user logged in');
        return;
      }

      try {
    
        
        const { error } = await supabase
          .from('users')
          .update({ last_accessed_school_id: schoolId })
          .eq('id', user.id);

        if (error) {
          console.error('[AuthContext] Error updating last accessed school:', error);
          return;
        }

        // Update the local user state to reflect the change
        setUser(prevUser => prevUser ? {
          ...prevUser,
          last_accessed_school_id: schoolId
        } : null);


      } catch (error) {
        console.error('[AuthContext] Exception updating last accessed school:', error);
      }
    },
    forgotPassword: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};