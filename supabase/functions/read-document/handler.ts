// The read-document request handler. Every outside service is injected, so the same
// code runs under Deno (index.ts) and under Vitest (index.test.ts).
// Contract: docs/contracts/read-document.md.
import { parseCandidates } from './schema.ts';

/** Google AI reads one account may ever use. */
export const USER_READ_LIMIT = 5;
/** Largest stored image the function will send, in bytes (10 MB, the bucket limit). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** How often a counter update is retried when another request changed it first. */
const SWAP_ATTEMPTS = 8;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const ALLOWED_MIME = new Set(Object.values(IMAGE_TYPES));

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Compare-and-set access to the two counters. A swap writes `to` only where the stored
 * value still equals `from` (an UPDATE ... WHERE gemini_reads = from) and says whether a
 * row changed. Each successful swap moves a counter by exactly one from a value below
 * its limit, so concurrent requests can never push it past the limit.
 */
export interface Counters {
  /** The account's reads so far, or null when the account has no profile row. */
  userReads(userId: string): Promise<number | null>;
  swapUserReads(userId: string, from: number, to: number): Promise<boolean>;
  /** The app's reads on this UTC day, creating the day's row at 0 if it is missing. */
  dayReads(day: string): Promise<number>;
  swapDayReads(day: string, from: number, to: number): Promise<boolean>;
}

export interface ReadDocumentDeps {
  apiKey: string | undefined;
  model: string;
  dailyCap: number;
  /** Today's date in UTC, YYYY-MM-DD. */
  today(): string;
  /** The signed-in user behind an Authorization header, or null. */
  userId(authorization: string | null): Promise<string | null>;
  /** The document if it exists and belongs to userId, else null. */
  findDocument(userId: string, documentId: string): Promise<{ storagePath: string } | null>;
  downloadImage(storagePath: string): Promise<Blob | null>;
  counters: Counters;
  /** Sends the image to Gemini and returns the parsed JSON reply. Throws on failure. */
  readImage(input: { apiKey: string; model: string; image: Uint8Array; mimeType: string }): Promise<unknown>;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

const fail = {
  badRequest: () => json(400, { error: 'bad_request' }),
  unauthorized: () => json(401, { error: 'unauthorized' }),
  notFound: () => json(404, { error: 'not_found' }),
  method: () => json(405, { error: 'method_not_allowed' }),
  tooLarge: () => json(413, { error: 'too_large' }),
  notImage: () => json(415, { error: 'not_image' }),
  limit: () => json(429, { error: 'limit' }),
  unavailable: () => json(503, { error: 'unavailable' }),
};

type Claim = 'claimed' | 'limit' | 'busy';

/** Moves a counter up by one if it is below the limit. */
async function claim(read: () => Promise<number | null>, swap: (from: number, to: number) => Promise<boolean>, limit: number): Promise<Claim> {
  for (let attempt = 0; attempt < SWAP_ATTEMPTS; attempt++) {
    const current = await read();
    if (current === null || current >= limit) return 'limit';
    if (await swap(current, current + 1)) return 'claimed';
  }
  return 'busy';
}

/** Gives one read back. Best effort: the counter never goes below zero. */
async function release(read: () => Promise<number | null>, swap: (from: number, to: number) => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < SWAP_ATTEMPTS; attempt++) {
    const current = await read();
    if (current === null || current <= 0) return;
    if (await swap(current, current - 1)) return;
  }
}

function mimeTypeOf(image: Blob, storagePath: string): string | null {
  if (ALLOWED_MIME.has(image.type)) return image.type;
  const extension = storagePath.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_TYPES[extension] ?? null;
}

export function createHandler(deps: ReadDocumentDeps): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return fail.method();

    const userId = await deps.userId(request.headers.get('Authorization')).catch(() => null);
    if (!userId) return fail.unauthorized();

    let documentId: unknown;
    try {
      documentId = ((await request.json()) as { documentId?: unknown } | null)?.documentId;
    } catch {
      return fail.badRequest();
    }
    if (typeof documentId !== 'string' || !documentId) return fail.badRequest();

    // Checked before anything is read or counted, so a missing key costs the user nothing.
    if (!deps.apiKey) return fail.unavailable();

    // Unknown, malformed and someone else's document all get the same answer.
    if (!UUID.test(documentId)) return fail.notFound();
    const document = await deps.findDocument(userId, documentId).catch(() => null);
    if (!document) return fail.notFound();

    const image = await deps.downloadImage(document.storagePath).catch(() => null);
    if (!image) return fail.unavailable();
    if (image.size > MAX_IMAGE_BYTES) return fail.tooLarge();
    const mimeType = mimeTypeOf(image, document.storagePath);
    if (!mimeType) return fail.notImage();

    const { counters } = deps;
    const day = deps.today();
    const readUser = () => counters.userReads(userId);
    const swapUser = (from: number, to: number) => counters.swapUserReads(userId, from, to);

    try {
      const userClaim = await claim(readUser, swapUser, USER_READ_LIMIT);
      if (userClaim === 'limit') return fail.limit();
      if (userClaim === 'busy') return fail.unavailable();

      const dayClaim = await claim(() => counters.dayReads(day), (from, to) => counters.swapDayReads(day, from, to), deps.dailyCap);
      if (dayClaim !== 'claimed') {
        await release(readUser, swapUser);
        return dayClaim === 'limit' ? fail.limit() : fail.unavailable();
      }
    } catch {
      return fail.unavailable();
    }

    // From here the read is counted, even if Google fails: a failed call may still have
    // used Google's free quota, and the counters exist to protect it.
    try {
      const reply = await deps.readImage({ apiKey: deps.apiKey, model: deps.model, image: new Uint8Array(await image.arrayBuffer()), mimeType });
      return json(200, { candidates: parseCandidates(reply) });
    } catch {
      return fail.unavailable();
    }
  };
}
