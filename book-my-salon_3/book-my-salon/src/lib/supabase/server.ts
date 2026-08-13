import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../database.types';

/**
 * Server-side Supabase client bound to the current request's auth cookies.
 * Use this inside Server Components, Route Handlers and Server Actions so
 * every query runs as the authenticated user and is subject to RLS.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component with no writable cookie context — safe to ignore,
            // middleware refreshes the session cookie on the next request.
          }
        },
      },
    }
  );
}
