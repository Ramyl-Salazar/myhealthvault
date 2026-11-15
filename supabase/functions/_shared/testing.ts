// Test helpers for the share functions: an in-memory stand-in for the shares, records,
// profiles and share_access_log tables. Used by Vitest only; not part of any deployed bundle.
import type { AccessEntry, ShareRow } from './share.ts';
import { hashToken } from './token.ts';

type Row = Record<string, unknown>;

export const OWNER = '11111111-1111-4111-8111-111111111111';
export const STRANGER = '22222222-2222-4222-8222-222222222222';
export const REC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const REC_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const REC_NOT_SHARED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const REC_DELETED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const REC_STRANGER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const SHARE_ID = '99999999-9999-4999-8999-999999999999';
/** 43 base64url characters, the shape newShareToken makes. */
export const TOKEN = 'Q2xpbmljaWFuLXRlc3QtdG9rZW4tZm9yLXZpdGVzdHM';
export const NOW = new Date('2026-11-16T10:00:00Z');

export function recordRow(id: string, userId: string, overrides: Row = {}): Row {
  return {
    id,
    user_id: userId,
    type: 'diagnosis',
    title: `Record ${id.slice(0, 4)}`,
    occurred_on: '2026-01-02',
    details: { kind: 'diagnosis' },
    provider_name: 'Barangay Malaya Health Center',
    notes: null,
    status: 'active',
    trust_level: 'patient_entered',
    document_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    verified_by: null,
    verified_license: null,
    verified_at: null,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    // Columns no clinician may see, in case a query ever returns them.
    storage_path: `${userId}/secret.jpg`,
    extraction: { text: 'internal' },
    ...overrides,
  };
}

export interface World {
  now: Date;
  shares: Map<string, ShareRow>;
  records: Row[];
  profiles: Map<string, Row>;
  log: AccessEntry[];
}

export async function world(): Promise<World> {
  const share: ShareRow = {
    id: SHARE_ID,
    userId: OWNER,
    // REC_DELETED is a stale id: the record was deleted after the share was made.
    // REC_STRANGER is listed only to prove ids are always matched with the owner.
    recordIds: [REC_A, REC_B, REC_DELETED, REC_STRANGER],
    expiresAt: '2026-11-16T11:00:00Z',
    revokedAt: null,
  };
  return {
    now: new Date(NOW),
    shares: new Map([[await hashToken(TOKEN), share]]),
    records: [
      recordRow(REC_A, OWNER, { title: 'Type 2 diabetes', occurred_on: '2026-03-01' }),
      recordRow(REC_B, OWNER, { type: 'allergy', title: 'Penicillin', details: { kind: 'allergy', reaction: 'Rash', severity: 'moderate' } }),
      recordRow(REC_NOT_SHARED, OWNER, { title: 'Not shared' }),
      recordRow(REC_STRANGER, STRANGER, { title: 'Someone else' }),
    ],
    profiles: new Map([
      [OWNER, {
        id: OWNER,
        display_name: 'Lourdes Villareal',
        birth_date: '1968-03-12',
        sex: 'female',
        blood_type: 'O+',
        emergency_contacts: [{ name: 'Ramon Villareal', relation: 'Husband', phone: '0917 555 0142' }],
        emergency_consent: true,
        keep: false,
        gemini_reads: 2,
        created_at: '2026-01-01T00:00:00Z',
      }],
    ]),
    log: [],
  };
}

/** The share, records and log functions both handlers use, backed by the world. */
export function storeDeps(w: World) {
  return {
    now: () => new Date(w.now),
    findShare: async (tokenHash: string) => {
      const share = w.shares.get(tokenHash);
      return share ? { ...share, recordIds: [...share.recordIds] } : null;
    },
    logAccess: async (entry: AccessEntry) => {
      w.log.push({ ...entry });
    },
    loadPatient: async (userId: string) => {
      const row = w.profiles.get(userId);
      return row ? { ...row } : null;
    },
    loadRecords: async (userId: string, ids: string[]) =>
      w.records.filter(r => ids.includes(r.id as string) && r.user_id === userId).map(r => ({ ...r })),
    loadRecord: async (userId: string, id: string) => {
      const row = w.records.find(r => r.id === id && r.user_id === userId);
      return row ? { ...row } : null;
    },
    markVerified: async (input: { userId: string; recordId: string; verifiedBy: string; verifiedLicense: string; verifiedAt: string }) => {
      const row = w.records.find(r => r.id === input.recordId && r.user_id === input.userId && r.trust_level !== 'clinician_verified');
      if (!row) return null;
      Object.assign(row, {
        trust_level: 'clinician_verified',
        verified_by: input.verifiedBy,
        verified_license: input.verifiedLicense,
        verified_at: input.verifiedAt,
        updated_at: input.verifiedAt,
      });
      return { ...row };
    },
  };
}

export function post(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'TestBrowser/1.0 (Android 15)', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
