import { getProfile } from './profile';
import { listRecords } from './records';
import { getShareLog, listShares } from './shares';
import { check, supabase } from './supabase';

export async function exportAll(): Promise<Blob> {
  const [profile, records, shares] = await Promise.all([getProfile(), listRecords(), listShares()]);
  const documents = check(await supabase.from('documents').select('*').order('created_at', { ascending: false }), 'Could not load documents') ?? [];
  const accessLog = (await Promise.all(shares.map(share => getShareLog(share.id)))).flat();
  return new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, records, documents, shares, accessLog }, null, 2)], { type: 'application/json' });
}
