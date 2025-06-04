import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Session, User as SupabaseAuthUser } from '@supabase/supabase-js'; // Import Supabase types
import { supabase } from '../lib/supabaseClient'; // Import Supabase client
import { User as AppUserType, UserRole } from '../types'; // Rename User to AppUserType to avoid conflict
// Removed mock user data and useToast import as it's not directly used in Supabase integration here

interface AuthContextType {
  user: AppUserType | null;
  session: Session | null; // Add session state
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>; // Make logout async
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateLastAccessedSchool: (schoolId: string) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean; // Add loading state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUserType | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true); // Initial load is true
  const [profileFetchedForUserId, setProfileFetchedForUserId] = useState<string | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const onAuthStateChangeHandlerRef = useRef<((_event: string, session: Session | null) => Promise<void>) | null>(null);

  useEffect(() => {
    onAuthStateChangeHandlerRef.current = async (_event, currentSession) => {
      console.log("AuthContext: onAuthStateChange handler executing. Event:", _event, "Session ID:", currentSession?.user?.id, "Current User ID (state):", user?.id, "Profile for (state):", profileFetchedForUserId, "isFetchingProfile:", isFetchingProfile);
      setSession(currentSession);

      if (currentSession?.user) {
        // Improved logic: Don't refetch profile for token refresh if we already have the user
        const isNewUser = currentSession.user.id !== profileFetchedForUserId;
        const isInitialSignIn = _event === "SIGNED_IN" && !user;
        const isTokenRefreshWithoutUser = _event === "TOKEN_REFRESHED" && !user;
        const isManualCheck = _event === "INITIAL_SESSION_MANUAL_CHECK";
        
        const shouldFetchProfile = isNewUser || isInitialSignIn || isTokenRefreshWithoutUser || isManualCheck;

        // Prevent duplicate fetches
        if (shouldFetchProfile && !isFetchingProfile) {
          console.log("AuthContext: Need to fetch profile. User ID:", currentSession.user.id, "Profile for current state:", profileFetchedForUserId, "User exists in state:", !!user, "Event:", _event, "Reason:", isNewUser ? "new user" : isInitialSignIn ? "initial sign in" : isTokenRefreshWithoutUser ? "token refresh without user" : "manual check");
          setIsFetchingProfile(true);
          setLoading(true);
          try {
            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', currentSession.user.id)
              .single();

            if (profileError) {
              console.error('AuthContext: Error fetching user profile:', profileError);
              setUser(null);
              setProfileFetchedForUserId(null);
            } else if (profile) {
              console.log("AuthContext: Profile fetched successfully:", profile);
                setUser(profile as AppUserType);
                setProfileFetchedForUserId(currentSession.user.id);
                console.log("AuthContext: User state set with profile for ID:", currentSession.user.id);
            } else {
              console.warn('AuthContext: User profile not found for auth user:', currentSession.user.id);
              setUser(null);
              setProfileFetchedForUserId(null);
            }
          } catch (e) {
            console.error("AuthContext: Exception during profile fetch or processing:", e);
            setUser(null);
            setProfileFetchedForUserId(null);
          } finally {
            console.log("AuthContext: Profile fetch attempt finished. Setting loading to false.");
            setIsFetchingProfile(false);
            setLoading(false);
          }
        } else if (shouldFetchProfile && isFetchingProfile) {
          console.log("AuthContext: Profile fetch already in progress, skipping duplicate fetch for event:", _event);
        } else {
          console.log("AuthContext: Session event for user ID (", currentSession.user.id, "), profile already fetched. Event:", _event, "- no profile refetch needed");
          // For token refresh events where we already have the user, don't set loading to true
          if (loading && (_event === "TOKEN_REFRESHED" || (_event === "SIGNED_IN" && user && currentSession.user.id === profileFetchedForUserId))) {
            console.log("AuthContext: Token refresh event with existing user - ensuring loading is false");
            setLoading(false);
          }
        }
      } else { // No session or no user in session
        console.log("AuthContext: No session or user in session. Clearing user state and profile tracking.");
        setUser(null);
        setProfileFetchedForUserId(null);
        setIsFetchingProfile(false);
        if (loading) setLoading(false); // Ensure loading is false if it was true
      }
    };
  }, [user, profileFetchedForUserId, loading, isFetchingProfile]); // Dependencies for the handler logic.

  useEffect(() => {
    console.log("AuthContext: Subscribing to onAuthStateChange.");
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (onAuthStateChangeHandlerRef.current) {
        onAuthStateChangeHandlerRef.current(_event, session);
      }
    });
    
    // Initial check in case onAuthStateChange doesn't fire immediately or for initial session
    // This helps with faster initial session restoration on page refresh
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (onAuthStateChangeHandlerRef.current) {
        console.log("AuthContext: Manually calling handler for initial session check.");
        onAuthStateChangeHandlerRef.current('INITIAL_SESSION_MANUAL_CHECK', session);
      }
    });


    return () => {
      console.log("AuthContext: Unsubscribing from onAuthStateChange.");
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array: subscribe only once.

  const login = async (email: string, password: string) => {
    console.log("AuthContext: login function called. Email:", email);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("AuthContext: Supabase signInWithPassword error:", error);
        setLoading(false); 
        throw error;
      }
      console.log("AuthContext: signInWithPassword successful. Data:", data, "onAuthStateChange will now handle session.");
      // Don't set loading to false here - the onAuthStateChange handler will do that after fetching the profile
    } catch (e) {
      console.error("AuthContext: Exception in login function:", e);
      setLoading(false); 
      throw e; 
    }
  };

  const logout = async () => {
    console.log("AuthContext: logout function called.");
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("AuthContext: Supabase signOut error:", error);
      setLoading(false);
      throw error;
    }
    console.log("AuthContext: Supabase signOut successful. Local state will be cleared by onAuthStateChange.");
    // onAuthStateChange (via ref handler) will set loading to false
  };

  const resetPassword = async (email: string) => {
    console.log("AuthContext: resetPassword function called. Email:", email);
    setLoading(true);
    
    // Construct the redirect URL
    const redirectUrl = new URL('/reset-password', window.location.origin);
    
    console.log("Reset password redirect URL:", redirectUrl.toString());
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl.toString(),
    });
    
    setLoading(false); 
    if (error) {
      console.error("AuthContext: Supabase resetPasswordForEmail error:", error);
      throw error;
    }
    console.log("AuthContext: resetPasswordForEmail successful.");
  };

  const updatePassword = async (password: string) => {
    console.log("AuthContext: updatePassword function called.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error("AuthContext: Supabase updateUser error:", error);
        throw error;
      }
      console.log("AuthContext: Password update successful.");
    } finally {
      setLoading(false);
    }
  };

  const updateLastAccessedSchool = async (schoolId: string) => {
    console.log("AuthContext: updateLastAccessedSchool function called. School ID:", schoolId);
    if (!user?.id) {
      console.error("AuthContext: Cannot update last accessed school - no user ID");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ last_accessed_school_id: schoolId })
        .eq('id', user.id);

      if (error) {
        console.error("AuthContext: Supabase updateLastAccessedSchool error:", error);
        throw error;
      }
      
      // Update local user state
      setUser(prev => prev ? { ...prev, last_accessed_school_id: schoolId } : null);
      console.log("AuthContext: Last accessed school updated successfully.");
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!user && !!session;
  const isAdmin = false; // Role is now handled through user_schools, not direct user property

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      login, 
      logout, 
      resetPassword,
      updatePassword, 
      updateLastAccessedSchool,
      isAuthenticated, 
      isAdmin, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
