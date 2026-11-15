import { check, supabase } from './supabase';

let inFlight: Promise<void> | null = null;

// Two calls at once (React StrictMode runs effects twice) share one run, so
// only one anonymous user is created.
export function startDemo(): Promise<void> {
  if (!inFlight) {
    inFlight = runStartDemo().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runStartDemo(): Promise<void> {
  const existing = await supabase.auth.getSession();
  if (existing.error) throw new Error(`Could not read the session: ${existing.error.message}`);

  let userId: string | null = null;
  if (existing.data.session) {
    const stored = await supabase.auth.getUser();
    if (stored.error || !stored.data.user) {
      // The server deletes demo accounts after 7 days; drop the stale local session.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    } else {
      userId = stored.data.user.id;
    }
  }

  if (!userId) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`Could not start the demo: ${error.message}`);
    const fresh = await supabase.auth.getUser();
    if (fresh.error || !fresh.data.user) throw new Error('Could not start the demo: no user');
    userId = fresh.data.user.id;
  }

  const profile = check(
    await supabase.from('profiles').select('id').eq('id', userId).maybeSingle(),
    'Could not check the profile',
  );
  if (!profile) await resetDemo();
}

export async function resetDemo(): Promise<void> {
  const { error } = await supabase.rpc('seed_demo_data');
  if (error) throw new Error(`Could not reset the demo: ${error.message}`);
}
