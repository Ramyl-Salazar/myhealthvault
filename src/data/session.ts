import { check, supabase } from './supabase';

export async function startDemo(): Promise<void> {
  const existing = await supabase.auth.getSession();
  if (existing.error) throw new Error(`Could not read the session: ${existing.error.message}`);
  if (!existing.data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`Could not start the demo: ${error.message}`);
  }
  const user = await supabase.auth.getUser();
  if (user.error || !user.data.user) throw new Error('Could not start the demo: no user');

  const profile = check(
    await supabase.from('profiles').select('id').eq('id', user.data.user.id).maybeSingle(),
    'Could not check the profile',
  );
  if (!profile) await resetDemo();
}

export async function resetDemo(): Promise<void> {
  const { error } = await supabase.rpc('seed_demo_data');
  if (error) throw new Error(`Could not reset the demo: ${error.message}`);
}
