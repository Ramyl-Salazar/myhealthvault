import { clearEmergencyCard } from '../domain/emergency';
import { clearPin } from '../domain/pin';
import { safeStorage } from '../domain/storage';
import { persister, queryClient } from './queryClient';
import { currentUserId, supabase } from './supabase';

export async function deleteEverything(): Promise<void> {
  const userId = await currentUserId();
  const bucket = supabase.storage.from('documents');
  const files: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(userId, { limit: 100, offset });
    if (error) throw new Error(`Could not list documents: ${error.message}`);
    files.push(...(data ?? []).filter(item => item.name !== '.emptyFolderPlaceholder').map(item => `${userId}/${item.name}`));
    if (!data || data.length < 100) break;
  }
  const { error } = await supabase.rpc('delete_my_data');
  if (error) throw new Error(`Could not delete account data: ${error.message}`);
  for (let index = 0; index < files.length; index += 100) {
    try { await bucket.remove(files.slice(index, index + 100)); }
    catch { /* Database deletion has succeeded; continue local cleanup. */ }
  }
  clearEmergencyCard(); clearPin(); queryClient.clear();
  safeStorage.remove('mhv.notificationIds.v1');
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('share-url:')) sessionStorage.removeItem(key);
    }
  } catch { /* Session storage may be blocked. */ }
  await supabase.auth.signOut();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await persister.removeClient();
}
