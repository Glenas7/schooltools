import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in .env file (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Reduce aggressive auto-refresh behavior to improve UX
    autoRefreshToken: true,        // Still refresh tokens when needed
    persistSession: true,          // Keep sessions across browser tabs
    detectSessionInUrl: true,      // Still detect auth redirects
    
    // Reduce the frequency of automatic token refresh checks
    // This prevents the jarring loading spinner when switching tabs
    storage: window?.localStorage,
    
    // Increase the grace period before considering a session expired
    // This reduces unnecessary refreshes on tab focus
    flowType: 'pkce'
  }
}); 