import type { HealthRecord } from '../domain/types';

export interface ClinicianShare {
  patient: { displayName: string; birthDate: string | null; sex: string | null; bloodType: string | null };
  records: HealthRecord[];
  expiresAt: string;
}

export type LoadResult = { ok: true; data: ClinicianShare } | { ok: false; reason: 'ended' | 'error' };
export type VerifyResult = { ok: true; record: HealthRecord } | { ok: false; reason: 'ended' | 'error' };

const root = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'http://localhost:54321';
const apikey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'missing-anon-key';

async function post<T>(functionName: string, body: object): Promise<{ ok: true; data: T } | { ok: false; reason: 'ended' | 'error' }> {
  try {
    const response = await fetch(`${root}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey },
      body: JSON.stringify(body),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (response.status === 410) return { ok: false, reason: 'ended' };
    if (!response.ok) return { ok: false, reason: 'error' };
    return { ok: true, data: await response.json() as T };
  } catch { return { ok: false, reason: 'error' }; }
}

export async function loadClinicianShare(token: string): Promise<LoadResult> {
  return post<ClinicianShare>('share-view', { token });
}

export async function verifyClinicianRecord(token: string, recordId: string, clinicianName: string, licenseNumber: string): Promise<VerifyResult> {
  const result = await post<{ record: HealthRecord }>('share-verify', { token, recordId, clinicianName, licenseNumber });
  return result.ok ? { ok: true, record: result.data.record } : result;
}
