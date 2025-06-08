import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Immediate, stricter checks
if (typeof supabaseUrl !== 'string' || supabaseUrl.trim() === '') {
  throw new Error(`FATAL: NEXT_PUBLIC_SUPABASE_URL is not a valid string or is empty. Value: '${supabaseUrl}'`);
}
if (typeof supabaseAnonKey !== 'string' || supabaseAnonKey.trim() === '') {
  throw new Error(`FATAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is not a valid string or is empty. Value: '${supabaseAnonKey}'`);
}
// For service key, it might be optional depending on usage, a console warning is fine if it's not always needed during build
// but if createAdminClient is called, it will throw if it's missing (as per existing logic below).
if (process.env.NODE_ENV === 'production' && (typeof supabaseServiceKey !== 'string' || supabaseServiceKey.trim() === '')) {
    console.warn(`WARNING: SUPABASE_SERVICE_ROLE_KEY is not a valid string or is empty. This might be an issue for admin operations if createAdminClient is used.`);
}

// No Aptos network config needed here; Supabase is network-agnostic.

// Create client with anonymous key (for client-side usage)
export const createClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
};

// Create admin client with service role key (for server-side only)
export const createAdminClient = () => {
  if (!supabaseServiceKey) {
    throw new Error("Supabase Service Role Key is not defined. Please set SUPABASE_SERVICE_ROLE_KEY for admin operations.");
  }
  
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
};

// Default export for convenience
export default createClient;