// @vitest-environment node
// Tests for the cleanup Edge Function. Auth, storage and the database are injected, so
// nothing here reaches the network. Contract: docs/contracts/cleanup.md.
import { describe, expect, it } from 'vitest';
import { createHandler, MAX_USERS_PER_RUN, type AuthUser, type CleanupDeps, type FolderEntry } from './handler.ts';

const URL_ = 'http://localhost/functions/v1/cleanup';
const SECRET = 'test-cleanup-secret-0123456789';
const NOW = new Date('2026-11-16T18:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const OLD_ANON = '10000000-0000-4000-8000-000000000001';
const YOUNG_ANON = '10000000-0000-4000-8000-000000000002';
const KEPT_ANON = '10000000-0000-4000-8000-000000000003';
const OLD_EMAIL_USER = '10000000-0000-4000-8000-000000000004';
const NO_PROFILE_ANON = '10000000-0000-4000-8000-000000000005';
const BROKEN_FILES_ANON = '10000000-0000-4000-8000-000000000006';

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

interface World {
  users: AuthUser[];
  /** Profile keep flags by user id. A missing id means the user has no profile row. */
  keep: Map<string, boolean>;
  /** Stored object paths in the documents bucket. */
  files: Set<string>;
  /** Every mutating call, in order. */
  events: string[];
  logs: string[];
}

function world(): World {
  return {
    users: [
      { id: OLD_ANON, isAnonymous: true, createdAt: daysAgo(8) },
      { id: YOUNG_ANON, isAnonymous: true, createdAt: daysAgo(6) },
      { id: KEPT_ANON, isAnonymous: true, createdAt: daysAgo(8) },
      { id: OLD_EMAIL_USER, isAnonymous: false, createdAt: daysAgo(30) },
    ],
    keep: new Map([
      [OLD_ANON, false],
      [YOUNG_ANON, false],
      [KEPT_ANON, true],
      [OLD_EMAIL_USER, false],
    ]),
    files: new Set([
      `${OLD_ANON}/a.jpg`,
      `${OLD_ANON}/b.png`,
      `${YOUNG_ANON}/c.jpg`,
      `${KEPT_ANON}/d.jpg`,
      `${OLD_EMAIL_USER}/e.jpg`,
    ]),
    events: [],
    logs: [],
  };
}

/** Lists one folder level of the in-memory bucket, sorted by name, like the Storage API. */
function listLevel(files: Set<string>, folder: string): FolderEntry[] {
  const prefix = `${folder}/`;
  const names = new Map<string, boolean>();
  for (const path of files) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash === -1) names.set(rest, false);
    else names.set(rest.slice(0, slash), true);
  }
  return [...names.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, isFolder]) => ({ name, isFolder }));
}

function depsFor(w: World, overrides: Partial<CleanupDeps> = {}): CleanupDeps {
  return {
    secret: SECRET,
    now: () => new Date(NOW),
    listUsers: async (page, perPage) => w.users.slice((page - 1) * perPage, page * perPage).map(u => ({ ...u })),
    keepFlags: async ids => new Map(ids.filter(id => w.keep.has(id)).map(id => [id, w.keep.get(id) as boolean])),
    listFolder: async (folder, offset, limit) => listLevel(w.files, folder).slice(offset, offset + limit),
    removeFiles: async paths => {
      w.events.push(`remove:${paths.join(',')}`);
      for (const path of paths) w.files.delete(path);
    },
    deleteUser: async id => {
      w.events.push(`delete:${id}`);
      w.users = w.users.filter(u => u.id !== id);
      w.keep.delete(id);
    },
    log: message => {
      w.logs.push(message);
    },
    ...overrides,
  };
}

function call(headers: Record<string, string> = { 'x-cleanup-secret': SECRET }, method = 'POST'): Request {
  return new Request(URL_, { method, headers });
}

function userIds(w: World): string[] {
  return w.users.map(u => u.id).sort();
}

describe('cleanup handler: secret', () => {
  it('answers 401 for a wrong secret and touches nothing', async () => {
    const w = world();
    const response = await createHandler(depsFor(w))(call({ 'x-cleanup-secret': 'wrong' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(w.events).toEqual([]);
  });

  it('answers 401 for a missing secret header', async () => {
    const w = world();
    const response = await createHandler(depsFor(w))(call({}));
    expect(response.status).toBe(401);
    expect(w.events).toEqual([]);
  });

  it('answers 401 for a secret that only shares a prefix with the real one', async () => {
    const w = world();
    const response = await createHandler(depsFor(w))(call({ 'x-cleanup-secret': SECRET.slice(0, -1) }));
    expect(response.status).toBe(401);
  });

  it('always answers 401 when CLEANUP_SECRET is not configured, even for an empty header', async () => {
    for (const secret of [undefined, '']) {
      const w = world();
      const handler = createHandler(depsFor(w, { secret }));
      expect((await handler(call({ 'x-cleanup-secret': '' }))).status).toBe(401);
      expect((await handler(call({}))).status).toBe(401);
      expect(w.events).toEqual([]);
    }
  });

  it('accepts only POST', async () => {
    const w = world();
    const handler = createHandler(depsFor(w));
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
      const response = await handler(call(undefined, method));
      expect(response.status).toBe(405);
    }
    expect(w.events).toEqual([]);
  });

  it('sends no CORS headers and is never cached', async () => {
    const response = await createHandler(depsFor(world()))(call());
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('cleanup handler: who is deleted', () => {
  it('deletes an 8-day-old anonymous user, removing their files before the user', async () => {
    const w = world();
    const response = await createHandler(depsFor(w))(call());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedUsers: 1 });
    expect(w.events).toEqual([`remove:${OLD_ANON}/a.jpg,${OLD_ANON}/b.png`, `delete:${OLD_ANON}`]);
    expect([...w.files].some(p => p.startsWith(`${OLD_ANON}/`))).toBe(false);
  });

  it('keeps a 6-day-old anonymous user and their files', async () => {
    const w = world();
    await createHandler(depsFor(w))(call());
    expect(userIds(w)).toContain(YOUNG_ANON);
    expect(w.files.has(`${YOUNG_ANON}/c.jpg`)).toBe(true);
  });

  it('keeps an 8-day-old anonymous user whose profile has keep = true', async () => {
    const w = world();
    await createHandler(depsFor(w))(call());
    expect(userIds(w)).toContain(KEPT_ANON);
    expect(w.files.has(`${KEPT_ANON}/d.jpg`)).toBe(true);
  });

  it('never deletes a non-anonymous user, however old', async () => {
    const w = world();
    await createHandler(depsFor(w))(call());
    expect(userIds(w)).toContain(OLD_EMAIL_USER);
    expect(w.files.has(`${OLD_EMAIL_USER}/e.jpg`)).toBe(true);
    expect(w.events.some(e => e.includes(OLD_EMAIL_USER))).toBe(false);
  });

  it('treats a missing is_anonymous flag as not anonymous', async () => {
    const w = world();
    w.users = [{ id: OLD_ANON, isAnonymous: undefined as unknown as boolean, createdAt: daysAgo(8) }];
    const body = await (await createHandler(depsFor(w))(call())).json();
    expect(body).toEqual({ deletedUsers: 0 });
    expect(w.events).toEqual([]);
  });

  it('keeps a user created exactly 7 days ago, or with an unreadable created_at', async () => {
    const w = world();
    w.users = [
      { id: OLD_ANON, isAnonymous: true, createdAt: daysAgo(7) },
      { id: NO_PROFILE_ANON, isAnonymous: true, createdAt: 'not a date' },
    ];
    const body = await (await createHandler(depsFor(w))(call())).json();
    expect(body).toEqual({ deletedUsers: 0 });
    expect(w.events).toEqual([]);
  });

  it('deletes an old anonymous user that has no profile row', async () => {
    const w = world();
    w.users.push({ id: NO_PROFILE_ANON, isAnonymous: true, createdAt: daysAgo(9) });
    const body = await (await createHandler(depsFor(w))(call())).json();
    expect(body).toEqual({ deletedUsers: 2 });
    expect(userIds(w)).not.toContain(NO_PROFILE_ANON);
    // No files: the user is deleted without a remove call.
    expect(w.events).toContain(`delete:${NO_PROFILE_ANON}`);
    expect(w.events.filter(e => e.includes(NO_PROFILE_ANON))).toEqual([`delete:${NO_PROFILE_ANON}`]);
  });

  it('never acts on a user id that is not a uuid, so the bucket root is never listed', async () => {
    const w = world();
    const listed: string[] = [];
    w.users = [{ id: '', isAnonymous: true, createdAt: daysAgo(8) }, { id: '../x', isAnonymous: true, createdAt: daysAgo(8) }];
    const deps = depsFor(w);
    const body = await (await createHandler({
      ...deps,
      listFolder: async (folder, offset, limit) => {
        listed.push(folder);
        return deps.listFolder(folder, offset, limit);
      },
    })(call())).json();
    expect(body).toEqual({ deletedUsers: 0 });
    expect(listed).toEqual([]);
    expect(w.events).toEqual([]);
  });
});

describe('cleanup handler: failures', () => {
  it('leaves a user in place when their files cannot be removed, and the rest proceed', async () => {
    const w = world();
    w.users.unshift({ id: BROKEN_FILES_ANON, isAnonymous: true, createdAt: daysAgo(10) });
    w.keep.set(BROKEN_FILES_ANON, false);
    w.files.add(`${BROKEN_FILES_ANON}/x.jpg`);
    const deps = depsFor(w);
    const response = await createHandler({
      ...deps,
      removeFiles: async paths => {
        if (paths.some(p => p.startsWith(BROKEN_FILES_ANON))) throw new Error('storage down');
        return deps.removeFiles(paths);
      },
    })(call());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedUsers: 1 });
    expect(userIds(w)).toContain(BROKEN_FILES_ANON);
    expect(userIds(w)).not.toContain(OLD_ANON);
    expect(w.events).not.toContain(`delete:${BROKEN_FILES_ANON}`);
  });

  it('leaves a user in place when a remove call reports success but files remain', async () => {
    const w = world();
    const response = await createHandler(depsFor(w, { removeFiles: async paths => { w.events.push(`remove:${paths.length}`); } }))(call());
    expect(await response.json()).toEqual({ deletedUsers: 0 });
    expect(userIds(w)).toContain(OLD_ANON);
  });

  it('leaves a user in place when listing their files fails', async () => {
    const w = world();
    const response = await createHandler(depsFor(w, { listFolder: async () => { throw new Error('storage down'); } }))(call());
    expect(await response.json()).toEqual({ deletedUsers: 0 });
    expect(userIds(w)).toContain(OLD_ANON);
    expect(w.events).toEqual([]);
  });

  it('counts only real deletions when deleting a user fails', async () => {
    const w = world();
    w.users.push({ id: NO_PROFILE_ANON, isAnonymous: true, createdAt: daysAgo(9) });
    const deps = depsFor(w);
    const response = await createHandler({
      ...deps,
      deleteUser: async id => {
        if (id === OLD_ANON) throw new Error('auth down');
        return deps.deleteUser(id);
      },
    })(call());
    expect(await response.json()).toEqual({ deletedUsers: 1 });
    expect(userIds(w)).toContain(OLD_ANON);
    expect(userIds(w)).not.toContain(NO_PROFILE_ANON);
  });

  it('deletes nobody and answers 503 when the keep flags cannot be read', async () => {
    const w = world();
    const response = await createHandler(depsFor(w, { keepFlags: async () => { throw new Error('db down'); } }))(call());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(w.events).toEqual([]);
  });

  it('deletes nobody and answers 503 when the user list cannot be read', async () => {
    const w = world();
    const response = await createHandler(depsFor(w, { listUsers: async () => { throw new Error('auth down'); } }))(call());
    expect(response.status).toBe(503);
    expect(w.events).toEqual([]);
  });

  it('never puts a user id in a log line or the response', async () => {
    const w = world();
    w.users.unshift({ id: BROKEN_FILES_ANON, isAnonymous: true, createdAt: daysAgo(10) });
    w.files.add(`${BROKEN_FILES_ANON}/x.jpg`);
    const deps = depsFor(w);
    const response = await createHandler({
      ...deps,
      removeFiles: async paths => {
        if (paths.some(p => p.startsWith(BROKEN_FILES_ANON))) throw new Error(`failed for ${BROKEN_FILES_ANON}`);
        return deps.removeFiles(paths);
      },
    })(call());
    const text = await response.text();
    expect(w.logs.length).toBeGreaterThan(0);
    for (const line of [...w.logs, text]) {
      expect(line).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
  });
});

describe('cleanup handler: paging and limits', () => {
  it('lists every page of a folder and nested folders before removing, in batches', async () => {
    const w = world();
    w.files.clear();
    const expected: string[] = [];
    for (let i = 0; i < 250; i += 1) {
      const path = `${OLD_ANON}/${String(i).padStart(3, '0')}.jpg`;
      w.files.add(path);
      expected.push(path);
    }
    w.files.add(`${OLD_ANON}/sub/z.jpg`);
    expected.push(`${OLD_ANON}/sub/z.jpg`);
    const offsets: number[] = [];
    const deps = depsFor(w);
    const response = await createHandler({
      ...deps,
      listFolder: async (folder, offset, limit) => {
        if (folder === OLD_ANON) offsets.push(offset);
        return deps.listFolder(folder, offset, limit);
      },
    })(call());
    expect(await response.json()).toEqual({ deletedUsers: 1 });
    expect(offsets.slice(0, 3)).toEqual([0, 100, 200]);
    const removed = w.events.filter(e => e.startsWith('remove:')).flatMap(e => e.slice('remove:'.length).split(','));
    expect(removed.sort()).toEqual(expected.sort());
    expect(w.events.filter(e => e.startsWith('remove:')).every(e => e.split(',').length <= 100)).toBe(true);
    expect(w.events.at(-1)).toBe(`delete:${OLD_ANON}`);
    expect(w.files.size).toBe(0);
  });

  it('reads every page of the user list', async () => {
    const w = world();
    const filler: AuthUser[] = Array.from({ length: 1500 }, (_, i) => ({
      id: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      isAnonymous: false,
      createdAt: daysAgo(30),
    }));
    w.users = [...filler, { id: OLD_ANON, isAnonymous: true, createdAt: daysAgo(8) }];
    const body = await (await createHandler(depsFor(w))(call())).json();
    expect(body).toEqual({ deletedUsers: 1 });
  });

  it(`attempts at most ${MAX_USERS_PER_RUN} users per call`, async () => {
    const w = world();
    w.users = Array.from({ length: MAX_USERS_PER_RUN + 25 }, (_, i) => ({
      id: `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      isAnonymous: true,
      createdAt: daysAgo(8),
    }));
    w.keep.clear();
    w.files.clear();
    const body = await (await createHandler(depsFor(w))(call())).json();
    expect(body).toEqual({ deletedUsers: MAX_USERS_PER_RUN });
    expect(w.users).toHaveLength(25);
  });
});
