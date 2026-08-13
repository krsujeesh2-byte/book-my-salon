import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Server-only. Never import this file from a Client Component or anything
 * that ends up in a browser bundle (spec section 96: "no service role key
 * in browser"). Reserved for: seed scripts, scheduled escalation workers,
 * and platform-admin operations that must legitimately see across tenants.
 * Ordinary CRM reads/writes must go through the request-scoped server
 * client in server.ts so RLS applies.
 */
export function createAdminSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminSupabaseClient must never be called from client-side code.');
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
