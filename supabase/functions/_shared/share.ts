// What share-view and share-verify have in common: reading the body, finding a live
// share by its token's hash, the device summary for the log, and the record shape a
// clinician may see. Contract: docs/contracts/share.md.
import { json } from './cors.ts';
import { hashToken, isTokenShape } from './token.ts';

/** Largest request body either function reads, in bytes. A real request is under 1 KB. */
export const MAX_BODY_BYTES = 4096;
/** share_access_log.device is at most 200 characters. */
const MAX_DEVICE_LENGTH = 200;

type Row = Record<string, unknown>;

export interface ShareRow {
  id: string;
  userId: string;
  recordIds: string[];
  expiresAt: string;
  revokedAt: string | null;
}

export interface AccessEntry {
  shareId: string;
  action: 'viewed' | 'verified';
  recordId: string | null;
  device: string;
}

export interface ShareStore {
  now(): Date;
  /** The share whose token_hash equals the hash, or null. Never given the raw token. */
  findShare(tokenHash: string): Promise<ShareRow | null>;
  /** Writes one share_access_log row. Throws on failure. */
  logAccess(entry: AccessEntry): Promise<void>;
}

/**
 * A record as a clinician receives it: the HealthRecord shape from src/domain/types.ts,
 * with the owner's account id blanked (userId is always '') and no document link
 * (documentId is always null). Keep in step with HealthRecord.
 */
export interface SharedRecord {
  id: string;
  userId: '';
  type: string;
  title: string;
  occurredOn: string | null;
  details: unknown;
  providerName: string | null;
  notes: string | null;
  status: string;
  trustLevel: string;
  documentId: null;
  verifiedBy: string | null;
  verifiedLicense: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Copies only the HealthRecord fields from a records row. Any other column is dropped. */
export function sharedRecord(row: Row): SharedRecord {
  const text = (value: unknown) => (typeof value === 'string' ? value : null);
  return {
    id: row.id as string,
    userId: '',
    type: row.type as string,
    title: row.title as string,
    occurredOn: text(row.occurred_on),
    details: row.details,
    providerName: text(row.provider_name),
    notes: text(row.notes),
    status: row.status as string,
    trustLevel: row.trust_level as string,
    documentId: null,
    verifiedBy: text(row.verified_by),
    verifiedLicense: text(row.verified_license),
    verifiedAt: text(row.verified_at),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const fail = {
  badRequest: () => json(400, { error: 'bad_request' }),
  method: () => json(405, { error: 'method_not_allowed' }),
  ended: () => json(410, { error: 'ended' }),
  tooLarge: () => json(413, { error: 'too_large' }),
  unavailable: () => json(503, { error: 'unavailable' }),
};

/**
 * Reads at most MAX_BODY_BYTES and parses it as a JSON object. Stops reading as soon as
 * the cap is passed, so a large body is never held in memory.
 */
export async function readBody(request: Request): Promise<Row | 'too_large' | 'bad'> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return 'too_large';
  if (!request.body) return 'bad';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return 'too_large';
      }
      chunks.push(value);
    }
  } catch {
    return 'bad';
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : 'bad';
  } catch {
    return 'bad';
  }
}

/**
 * The share behind a token if it can be used at this moment, else null. Unknown,
 * malformed, expired and revoked tokens all give null, so callers answer them alike.
 * Only the hash leaves this function.
 */
export async function openShare(store: ShareStore, token: string): Promise<ShareRow | null> {
  if (!isTokenShape(token)) return null;
  const share = await store.findShare(await hashToken(token));
  if (!share || share.revokedAt !== null) return null;
  const expires = Date.parse(share.expiresAt);
  if (!Number.isFinite(expires) || expires <= store.now().getTime()) return null;
  return share;
}

/** The User-Agent, without control characters, cut to 200 characters. No IP address is kept. */
export function deviceSummary(request: Request): string {
  const agent = (request.headers.get('user-agent') ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return Array.from(agent).slice(0, MAX_DEVICE_LENGTH).join('');
}
