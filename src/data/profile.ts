import type { Profile } from '../domain/types';
import { profileFromRow, profileToRow } from './mappers';
import { check, currentUserId, supabase } from './supabase';

export async function getProfile(): Promise<Profile> {
  const id = await currentUserId();
  const row = check(await supabase.from('profiles').select('*').eq('id', id).single(), 'Could not load the profile');
  return profileFromRow(row);
}

// Update only: clients have no insert privilege on profiles.
export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const id = await currentUserId();
  const row = check(
    await supabase.from('profiles').update(profileToRow(patch)).eq('id', id).select().single(),
    'Could not save the profile',
  );
  return profileFromRow(row);
}
