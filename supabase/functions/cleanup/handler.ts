// The cleanup request handler. Auth, storage and database access are injected, so the
// same code runs under Deno (index.ts) and under Vitest (index.test.ts). Called once a
// day by .github/workflows/daily.yml. Contract: docs/contracts/cleanup.md.
//
// Deletes anonymous demo accounts older than 7 days, unless their profile has keep = true.
// Safety rules, each covered by a test:
// - Only a user whose is_anonymous is exactly true is ever deleted.
// - Age is measured from the auth user's created_at, strictly more than 7 days.
// - keep = true on the profile protects the user. A user with no profile row (they never
//   loaded the demo, or deleted their data) is deletable when anonymous and old enough.
// - If the keep flags cannot be read, nobody is deleted: a failed read is never taken
//   as "no profile".
// - Stored files are removed first. The user is deleted only once a fresh listing shows
//   the folder empty; otherwise the user stays and is retried the next day.
// - One failing user never stops the others. Only real deletions are counted.
// - No user id or email is logged or returned.

/** The most users one call will try to delete. The rest wait for the next run. */
export const MAX_USERS_PER_RUN = 200;
/** Users younger than this are never deleted. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Auth users read per page. */
export const USERS_PER_PAGE = 1000;
/** Pages of auth users read per call, to bound the work. */
export const MAX_USER_PAGES = 50;
/** Storage entries listed per request, and paths removed per request. */
export const FILES_PER_PAGE = 100;
/** Nested folders followed inside a user's folder. The app writes none; a client could. */
const MAX_FOLDER_DEPTH = 5;
/** Profile ids looked up per query. */
const IDS_PER_QUERY = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthUser {
  id: string;
  isAnonymous: boolean;
  /** ISO timestamp from auth.users.created_at. */
  createdAt: string;
}

export interface FolderEntry {
  name: string;
  isFolder: boolean;
}

export interface CleanupDeps {
  /** CLEANUP_SECRET. Unset or empty means every request is refused. */
  secret: string | undefined;
  now(): Date;
  /** One page (1-based) of auth users. A page shorter than perPage is the last. */
  listUsers(page: number, perPage: number): Promise<AuthUser[]>;
  /** keep for each id that has a profile row. Ids without a row are left out. Throws on failure. */
  keepFlags(ids: string[]): Promise<Map<string, boolean>>;
  /** One page of one folder level in the documents bucket, sorted by name. Throws on failure. */
  listFolder(folder: string, offset: number, limit: number): Promise<FolderEntry[]>;
  /** Removes these object paths from the documents bucket. Throws on failure. */
  removeFiles(paths: string[]): Promise<void>;
  /** Deletes the auth user; their rows cascade. Throws on failure. */
  deleteUser(id: string): Promise<void>;
  /** A log line. Never given a user id. */
  log(message: string): void;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** Compares in constant time: both sides are hashed to 32 bytes first, so length leaks nothing. */
async function secretMatches(expected: string | undefined, given: string | null): Promise<boolean> {
  if (!expected || given === null) return false;
  const [a, b] = await Promise.all([digest(expected), digest(given)]);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function isExpiredAnonymous(user: AuthUser, now: Date): boolean {
  if (user.isAnonymous !== true) return false;
  if (typeof user.id !== 'string' || !UUID_RE.test(user.id)) return false;
  const created = Date.parse(user.createdAt);
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created > MAX_AGE_MS;
}

/** The users to delete this run: anonymous, old enough, not kept. Throws if any read fails. */
async function findExpired(deps: CleanupDeps): Promise<string[]> {
  const now = deps.now();
  const chosen: string[] = [];
  for (let page = 1; page <= MAX_USER_PAGES && chosen.length < MAX_USERS_PER_RUN; page += 1) {
    const users = await deps.listUsers(page, USERS_PER_PAGE);
    const candidates = users.filter(user => isExpiredAnonymous(user, now)).map(user => user.id);
    for (let i = 0; i < candidates.length && chosen.length < MAX_USERS_PER_RUN; i += IDS_PER_QUERY) {
      const ids = candidates.slice(i, i + IDS_PER_QUERY);
      const keep = await deps.keepFlags(ids);
      for (const id of ids) {
        // No profile row: deletable. A row: deletable only when keep is exactly false.
        if (!keep.has(id) || keep.get(id) === false) chosen.push(id);
        if (chosen.length >= MAX_USERS_PER_RUN) break;
      }
    }
    if (users.length < USERS_PER_PAGE) break;
  }
  return chosen;
}

/** Every object path under folder, following nested folders. Lists all pages before returning. */
async function filesUnder(deps: CleanupDeps, folder: string, depth = 0): Promise<string[]> {
  if (depth > MAX_FOLDER_DEPTH) throw new Error('folders nested too deep');
  const paths: string[] = [];
  for (let offset = 0; ; offset += FILES_PER_PAGE) {
    const entries = await deps.listFolder(folder, offset, FILES_PER_PAGE);
    for (const entry of entries) {
      if (!entry.name) continue;
      const path = `${folder}/${entry.name}`;
      if (entry.isFolder) paths.push(...(await filesUnder(deps, path, depth + 1)));
      else paths.push(path);
    }
    if (entries.length < FILES_PER_PAGE) break;
  }
  return paths;
}

/** Removes the user's files, checks the folder is empty, then deletes the user. Throws on any failure. */
async function deleteOne(deps: CleanupDeps, userId: string): Promise<void> {
  // UUID_RE was checked in isExpiredAnonymous; checked again here because an empty or
  // odd id would make the folder the bucket root, which holds every user's files.
  if (!UUID_RE.test(userId)) throw new Error('bad id');
  const files = await filesUnder(deps, userId);
  for (let i = 0; i < files.length; i += FILES_PER_PAGE) {
    await deps.removeFiles(files.slice(i, i + FILES_PER_PAGE));
  }
  if (files.length > 0 && (await filesUnder(deps, userId)).length > 0) throw new Error('files remain');
  await deps.deleteUser(userId);
}

export function createHandler(deps: CleanupDeps): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (!(await secretMatches(deps.secret, request.headers.get('x-cleanup-secret')))) {
      return json(401, { error: 'unauthorized' });
    }

    let expired: string[];
    try {
      expired = await findExpired(deps);
    } catch {
      deps.log('cleanup: could not read users or profiles; nothing deleted');
      return json(503, { error: 'unavailable' });
    }

    let deletedUsers = 0;
    let failed = 0;
    for (const userId of expired) {
      try {
        await deleteOne(deps, userId);
        deletedUsers += 1;
      } catch {
        failed += 1;
      }
    }
    deps.log(`cleanup: deleted ${deletedUsers}, failed ${failed}, attempted ${expired.length}`);
    return json(200, { deletedUsers });
  };
}
