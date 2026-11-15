import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Placeholders keep the module importable when the env is not set (tests, a
// first build). Any real call then fails with a plain network error.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key');

/** Throws a plain Error with a short message when a Supabase call failed. */
export function check<T>(result: { data: T; error: { message: string } | null }, action: string): T {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Could not read the session: ${error.message}`);
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}
