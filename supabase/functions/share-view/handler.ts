// The share-view request handler. Database access is injected, so the same code runs
// under Deno (index.ts) and under Vitest (index.test.ts). Public: no sign-in, the token
// is the only key. Contract: docs/contracts/share.md.
import { json, preflight } from '../_shared/cors.ts';
import { deviceSummary, fail, openShare, readBody, sharedRecord, type ShareStore } from '../_shared/share.ts';

type Row = Record<string, unknown>;

export interface ShareViewDeps extends ShareStore {
  /** The owner's profile row, or null. Only the four patient fields are read from it. */
  loadPatient(userId: string): Promise<Row | null>;
  /** Records whose id is in ids and whose user_id is userId. */
  loadRecords(userId: string, ids: string[]): Promise<Row[]>;
}

function patientOf(row: Row | null) {
  const text = (value: unknown) => (typeof value === 'string' ? value : null);
  return {
    displayName: text(row?.display_name) ?? '',
    birthDate: text(row?.birth_date),
    sex: text(row?.sex),
    bloodType: text(row?.blood_type),
  };
}

export function createHandler(deps: ShareViewDeps): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return fail.method();

    const body = await readBody(request);
    if (body === 'too_large') return fail.tooLarge();
    if (body === 'bad' || typeof body.token !== 'string') return fail.badRequest();

    try {
      const share = await openShare(deps, body.token);
      if (!share) return fail.ended();

      const [profile, rows] = await Promise.all([
        deps.loadPatient(share.userId),
        deps.loadRecords(share.userId, share.recordIds),
      ]);
      // The query already filters both ways; checking again here means a mistake there
      // can never hand a clinician a record outside the share or of another account.
      const shared = new Set(share.recordIds);
      const records = rows.filter(row => row.user_id === share.userId && shared.has(row.id as string)).map(sharedRecord);

      // Logged before anything is sent: no record leaves without a log row.
      await deps.logAccess({ shareId: share.id, action: 'viewed', recordId: null, device: deviceSummary(request) });
      return json(200, { patient: patientOf(profile), records, expiresAt: share.expiresAt });
    } catch {
      return fail.unavailable();
    }
  };
}
