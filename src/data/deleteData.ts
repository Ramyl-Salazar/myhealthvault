import { clearEmergencyCard } from '../domain/emergency';
import { clearPin } from '../domain/pin';
import { safeStorage } from '../domain/storage';
import { queryClient } from './queryClient';
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
  for (let index = 0; index < files.length; index += 100) {
    const { error } = await bucket.remove(files.slice(index, index + 100));
    if (error) throw new Error(`Could not remove documents: ${error.message}`);
  }
  const { error } = await supabase.rpc('delete_my_data');
  if (error) throw new Error(`Could not delete account data: ${error.message}`);
  clearEmergencyCard(); clearPin(); queryClient.clear();
  safeStorage.remove('mhv-query-cache');
  safeStorage.remove('mhv.notificationIds.v1');
  await supabase.auth.signOut();
}
