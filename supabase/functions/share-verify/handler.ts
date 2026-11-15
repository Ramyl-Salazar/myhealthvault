// The share-verify request handler. Database access is injected, so the same code runs
// under Deno (index.ts) and under Vitest (index.test.ts). Public: no sign-in, the token
// is the only key. Contract: docs/contracts/share.md.
import { json, preflight } from '../_shared/cors.ts';
import { deviceSummary, fail, openShare, readBody, sharedRecord, type ShareStore } from '../_shared/share.ts';

/** records.verified_by is at most 200 characters. */
export const MAX_NAME_LENGTH = 200;
/** records.verified_license is at most 100 characters. */
export const MAX_LICENSE_LENGTH = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u001f\u007f]|\p{Cf}/u;

type Row = Record<string, unknown>;

export interface ShareVerifyDeps extends ShareStore {
  /** The record with this id owned by userId, or null. */
  loadRecord(userId: string, recordId: string): Promise<Row | null>;
  /**
   * Sets trust_level 'clinician_verified' and the three verifier fields in one update,
   * only where the record is owned by userId and is not already clinician verified.
   * Returns the updated row, or null when no row matched.
   */
  markVerified(input: { userId: string; recordId: string; verifiedBy: string; verifiedLicense: string; verifiedAt: string }): Promise<Row | null>;
}

/** Trimmed text if it is non-blank, within the cap and free of control characters, else null. */
function typedField(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (!trimmed || CONTROL.test(trimmed) || Array.from(trimmed).length > max) return null;
  return trimmed;
}

export function createHandler(deps: ShareVerifyDeps): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return fail.method();

    const body = await readBody(request);
    if (body === 'too_large') return fail.tooLarge();
    if (body === 'bad') return fail.badRequest();
    const { token, recordId, clinicianName, licenseNumber } = body;
    if (typeof token !== 'string' || typeof recordId !== 'string' || typeof clinicianName !== 'string' || typeof licenseNumber !== 'string') {
      return fail.badRequest();
    }

    try {
      // Checked first, on every call: a link that ended after the page was opened
      // answers 410 whatever else the request holds.
      const share = await openShare(deps, token);
      if (!share) return fail.ended();

      const verifiedBy = typedField(clinicianName, MAX_NAME_LENGTH);
      const verifiedLicense = typedField(licenseNumber, MAX_LICENSE_LENGTH);
      if (!verifiedBy || !verifiedLicense) return fail.badRequest();
      if (!UUID.test(recordId) || !share.recordIds.includes(recordId)) return fail.badRequest();

      // A stale id (record deleted since) or an id of another account finds nothing.
      const current = await deps.loadRecord(share.userId, recordId);
      if (!current) return fail.badRequest();

      // A verification already on the record is kept as it is and not logged again.
      if (current.trust_level === 'clinician_verified') return json(200, { record: sharedRecord(current) });

      const updated = await deps.markVerified({
        userId: share.userId,
        recordId,
        verifiedBy,
        verifiedLicense,
        verifiedAt: deps.now().toISOString(),
      });
      if (!updated) {
        // Another request verified it in the meantime: answer with that verification.
        const latest = await deps.loadRecord(share.userId, recordId);
        return latest ? json(200, { record: sharedRecord(latest) }) : fail.badRequest();
      }

      await deps.logAccess({ shareId: share.id, action: 'verified', recordId, device: deviceSummary(request) });
      return json(200, { record: sharedRecord(updated) });
    } catch {
      return fail.unavailable();
    }
  };
}
