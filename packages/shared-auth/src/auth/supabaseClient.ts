import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  options?: SupabaseClientOptions<'public'>;
}

// Create a configurable Supabase client factory
export function createSupabaseClient(config: SupabaseConfig) {
  return createClient(config.url, config.anonKey, config.options);
}

// Default configuration for single-module usage (backwards compatible)
export function createDefaultSupabaseClient(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
}

// Enhanced configuration for multi-module cross-subdomain usage
// Note: Cross-subdomain configuration will be handled via DNS/server configuration
// and manual cookie sharing for now, as Supabase doesn't natively support custom domains in client config
export function createCrossSubdomainSupabaseClient(url: string, anonKey: string, storageKey: string = 'schooltools-auth') {
  return createClient(url, anonKey, {
    auth: {
      storageKey,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
} 