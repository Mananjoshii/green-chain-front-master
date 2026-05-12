import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../env.js";

let cachedAdmin: SupabaseClient | null = null;
let cachedAnon: SupabaseClient | null = null;

export function getAnonSupabase(env: Env): SupabaseClient {
  if (cachedAnon) return cachedAnon;
  cachedAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return cachedAnon;
}

export function getAdminSupabase(env: Env): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  cachedAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return cachedAdmin;
}

