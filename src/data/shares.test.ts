import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../domain/share';

type Row = Record<string, unknown>;
interface Call { table: string; op: string; payload?: unknown; filters: [string, string, unknown][]; columns?: string; order?: [string, unknown] }
const calls: Call[] = [];
let result: { data: unknown; error: { message: string } | null } = { data: null, error: null };

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  calls.push(call);
  const b: Record<string, unknown> = {};
  b.insert = (payload: Row) => { call.op = 'insert'; call.payload = payload; return b; };
  b.update = (payload: Row) => { call.op = 'update'; call.payload = payload; return b; };
  b.select = (columns: string) => { call.columns = columns; return b; };
  b.eq = (column: string, value: unknown) => { call.filters.push(['eq', column, value]); return b; };
  b.is = (column: string, value: unknown) => { call.filters.push(['is', column, value]); return b; };
  b.order = (column: string, options: unknown) => { call.order = [column, options]; return b; };
  b.single = () => Promise.resolve(result);
  b.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return b;
}

vi.mock('./supabase', async importOriginal => ({
  ...(await importOriginal<typeof import('./supabase')>()),
  supabase: { from: (table: string) => builder(table) },
}));

import { createShare, getShareLog, listShares, revokeShare } from './shares';

beforeEach(() => {
  calls.length = 0;
  result = { data: null, error: null };
  vi.useRealTimers();
});

describe('createShare', () => {
  it('stores only the SHA-256 hash of the token and returns the link with the raw token', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-16T10:00:00Z'), toFake: ['Date'] });
    result = { data: { id: 's1', expires_at: '2026-11-16T11:00:00+00:00' }, error: null };
    const share = await createShare({ label: ' For Dr. Cruz ', recordIds: ['r1', 'r2'], minutes: 60 });

    const insert = calls[0];
    expect(insert.table).toBe('shares');
    expect(insert.op).toBe('insert');
    const payload = insert.payload as Row;
    expect(Object.keys(payload).sort()).toEqual(['expires_at', 'label', 'record_ids', 'token_hash']);
    expect(payload).toMatchObject({ label: 'For Dr. Cruz', record_ids: ['r1', 'r2'], expires_at: '2026-11-16T11:00:00.000Z' });
    expect(payload.token_hash).toMatch(/^[0-9a-f]{64}$/);

    const token = share.url.split('/s/')[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await sha256Hex(token)).toBe(payload.token_hash);
    expect(JSON.stringify(calls)).not.toContain(token);
    expect(insert.columns).not.toContain('token_hash');
    expect(share).toEqual({ id: 's1', url: share.url, expiresAt: '2026-11-16T11:00:00+00:00' });
  });

  it('refuses no records, a duration not on the list, and a label over 200 characters, without calling Supabase', async () => {
    await expect(createShare({ label: '', recordIds: [], minutes: 60 })).rejects.toThrow();
    await expect(createShare({ label: '', recordIds: ['r1'], minutes: 30 as 60 })).rejects.toThrow();
    await expect(createShare({ label: 'x'.repeat(201), recordIds: ['r1'], minutes: 60 })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('sends each record id once', async () => {
    result = { data: { id: 's1', expires_at: 'e' }, error: null };
    await createShare({ label: '', recordIds: ['r1', 'r1', 'r2'], minutes: 15 });
    expect((calls[0].payload as Row).record_ids).toEqual(['r1', 'r2']);
  });

  it('throws a plain Error when Supabase fails', async () => {
    result = { data: null, error: { message: 'boom' } };
    await expect(createShare({ label: '', recordIds: ['r1'], minutes: 15 })).rejects.toThrow('Could not create the share: boom');
  });
});

describe('listShares', () => {
  it('maps rows newest first and never reads the token hash', async () => {
    result = {
      data: [{ id: 's1', label: 'Clinic', record_ids: ['r1'], expires_at: 'e', revoked_at: null, created_at: 'c' }],
      error: null,
    };
    expect(await listShares()).toEqual([{ id: 's1', label: 'Clinic', recordIds: ['r1'], expiresAt: 'e', revokedAt: null, createdAt: 'c' }]);
    expect(calls[0].columns).not.toContain('token_hash');
    expect(calls[0].order).toEqual(['created_at', { ascending: false }]);
  });
});

describe('getShareLog', () => {
  it("maps one share's log entries, newest first", async () => {
    result = { data: [{ id: 'l1', action: 'verified', record_id: 'r1', device: 'Phone', created_at: 't' }], error: null };
    expect(await getShareLog('s1')).toEqual([{ id: 'l1', action: 'verified', recordId: 'r1', device: 'Phone', createdAt: 't' }]);
    expect(calls[0].table).toBe('share_access_log');
    expect(calls[0].filters).toEqual([['eq', 'share_id', 's1']]);
    expect(calls[0].order).toEqual(['created_at', { ascending: false }]);
  });
});

describe('revokeShare', () => {
  it('sets revoked_at only on a share that is not revoked yet', async () => {
    await revokeShare('s1');
    expect(calls[0].op).toBe('update');
    expect(Object.keys(calls[0].payload as Row)).toEqual(['revoked_at']);
    expect(calls[0].filters).toEqual([['eq', 'id', 's1'], ['is', 'revoked_at', null]]);
  });

  it('throws a plain Error when Supabase fails', async () => {
    result = { data: null, error: { message: 'boom' } };
    await expect(revokeShare('s1')).rejects.toThrow('Could not stop sharing: boom');
  });
});
