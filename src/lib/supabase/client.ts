'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../database.types';

/**
 * Browser-side Supabase client. Only ever uses the public anon key — RLS
 * policies (supabase/migrations) are what actually enforce tenant isolation
 * for anything this client touches. Never import the service role key here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
