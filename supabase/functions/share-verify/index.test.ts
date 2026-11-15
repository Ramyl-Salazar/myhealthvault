// @vitest-environment node
// Tests for the share-verify Edge Function. Database access is injected, so nothing here
// reaches the network. Contract: docs/contracts/share.md.
import { describe, expect, it, vi } from 'vitest';
import { createHandler as createViewHandler } from '../share-view/handler.ts';
import {
  OWNER, REC_A, REC_DELETED, REC_NOT_SHARED, REC_STRANGER, SHARE_ID, TOKEN, post, storeDeps, world, type World,
} from '../_shared/testing.ts';
import { MAX_LICENSE_LENGTH, MAX_NAME_LENGTH, createHandler, type ShareVerifyDeps } from './handler.ts';

const URL_ = 'http://localhost/functions/v1/share-verify';
const ENDED = { error: 'ended' };
const BAD = { error: 'bad_request' };

function handlerFor(w: World, overrides: Partial<ShareVerifyDeps> = {}) {
  return createHandler({ ...storeDeps(w), ...overrides });
}

const valid = { token: TOKEN, recordId: REC_A, clinicianName: '  Dr. Isabel Cruz-Manalo ', licenseNumber: ' 0098765 ' };

function rowOf(w: World, id: string) {
  return { ...w.records.find(r => r.id === id) };
}

describe('share-verify handler', () => {
  it('sets the three verifier fields together, returns the record and writes one log row', async () => {
    const w = await world();
    const response = await handlerFor(w)(post(URL_, valid));
    expect(response.status).toBe(200);
    const { record } = await response.json();
    expect(record).toMatchObject({
      id: REC_A,
      trustLevel: 'clinician_verified',
      verifiedBy: 'Dr. Isabel Cruz-Manalo',
      verifiedLicense: '0098765',
      verifiedAt: '2026-11-16T10:00:00.000Z',
      userId: '',
      documentId: null,
    });
    expect(rowOf(w, REC_A)).toMatchObject({
      trust_level: 'clinician_verified',
      verified_by: 'Dr. Isabel Cruz-Manalo',
      verified_license: '0098765',
      verified_at: '2026-11-16T10:00:00.000Z',
    });
    expect(w.log).toEqual([{ shareId: SHARE_ID, action: 'verified', recordId: REC_A, device: 'TestBrowser/1.0 (Android 15)' }]);
    const text = JSON.stringify(record);
    expect(text).not.toContain(OWNER);
    expect(text).not.toContain('secret.jpg');
  });

  it('Review Focus 2: a share revoked between a view and a verify answers 410 and leaves the record unchanged', async () => {
    const w = await world();
    const view = await createViewHandler(storeDeps(w))(post('http://localhost/functions/v1/share-view', { token: TOKEN }));
    expect(view.status).toBe(200);
    for (const share of w.shares.values()) share.revokedAt = '2026-11-16T10:00:00Z';
    const before = rowOf(w, REC_A);
    const markVerified = vi.fn(storeDeps(w).markVerified);
    const response = await handlerFor(w, { markVerified })(post(URL_, valid));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual(ENDED);
    expect(markVerified).not.toHaveBeenCalled();
    expect(rowOf(w, REC_A)).toEqual(before);
    expect(w.log.map(e => e.action)).toEqual(['viewed']);
  });

  it('answers 410 when the link expired after it was opened, and changes nothing', async () => {
    const w = await world();
    w.now = new Date('2026-11-16T11:00:01Z');
    const before = rowOf(w, REC_A);
    const response = await handlerFor(w)(post(URL_, valid));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual(ENDED);
    expect(rowOf(w, REC_A)).toEqual(before);
    expect(w.log).toEqual([]);
  });

  it('answers an unknown token with the same 410 body', async () => {
    const w = await world();
    const response = await handlerFor(w)(post(URL_, { ...valid, token: 'B'.repeat(43) }));
    expect(response.status).toBe(410);
    expect(await response.text()).toBe(JSON.stringify(ENDED));
  });

  it('answers 400 for a record outside the share, a stale id, or a listed id of another user', async () => {
    const w = await world();
    const handler = handlerFor(w);
    for (const recordId of [REC_NOT_SHARED, REC_DELETED, REC_STRANGER, 'not-a-uuid']) {
      const response = await handler(post(URL_, { ...valid, recordId }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(BAD);
    }
    expect(rowOf(w, REC_NOT_SHARED).trust_level).toBe('patient_entered');
    expect(rowOf(w, REC_STRANGER).trust_level).toBe('patient_entered');
    expect(w.log).toEqual([]);
  });

  it('answers 400 for a blank name or licence, and for one over its length cap', async () => {
    const w = await world();
    const handler = handlerFor(w);
    const bad = [
      { ...valid, clinicianName: '   ' },
      { ...valid, licenseNumber: '\t' },
      { ...valid, clinicianName: '​' },
      { ...valid, clinicianName: 'Dr. ‮Abc' },
      { ...valid, clinicianName: 'x'.repeat(MAX_NAME_LENGTH + 1) },
      { ...valid, licenseNumber: '9'.repeat(MAX_LICENSE_LENGTH + 1) },
    ];
    for (const body of bad) expect((await handler(post(URL_, body))).status).toBe(400);
    expect(rowOf(w, REC_A).trust_level).toBe('patient_entered');
    expect(w.log).toEqual([]);
  });

  it('answers 400 for fields of the wrong type or a body that is not an object', async () => {
    const w = await world();
    const handler = handlerFor(w);
    const bad: unknown[] = [
      { ...valid, recordId: 7 },
      { ...valid, clinicianName: ['Dr. X'] },
      { ...valid, licenseNumber: null },
      { ...valid, token: { $ne: '' } },
      [valid],
      'nope',
    ];
    for (const body of bad) {
      const response = await handler(post(URL_, typeof body === 'string' ? body : JSON.stringify(body)));
      expect(response.status).toBe(400);
    }
    expect(w.log).toEqual([]);
  });

  it('leaves a record already verified by a clinician unchanged, answers 200 and logs nothing', async () => {
    const w = await world();
    Object.assign(w.records.find(r => r.id === REC_A)!, {
      trust_level: 'clinician_verified',
      verified_by: 'Dr. Paolo Santiago',
      verified_license: '0112233',
      verified_at: '2026-01-03T00:00:00Z',
    });
    const before = rowOf(w, REC_A);
    const response = await handlerFor(w)(post(URL_, valid));
    expect(response.status).toBe(200);
    const { record } = await response.json();
    expect(record).toMatchObject({ trustLevel: 'clinician_verified', verifiedBy: 'Dr. Paolo Santiago', verifiedLicense: '0112233' });
    expect(rowOf(w, REC_A)).toEqual(before);
    expect(w.log).toEqual([]);
  });

  it('verifies once when two clinicians press at the same time, with one log row', async () => {
    const w = await world();
    const handler = handlerFor(w);
    const responses = await Promise.all([
      handler(post(URL_, valid)),
      handler(post(URL_, { ...valid, clinicianName: 'Dr. Paolo Santiago', licenseNumber: '0112233' })),
    ]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map(r => r.json()));
    expect(bodies[0].record.verifiedBy).toBe(bodies[1].record.verifiedBy);
    expect(w.log.filter(e => e.action === 'verified')).toHaveLength(1);
  });

  it('never passes or logs the raw token', async () => {
    const w = await world();
    const deps = storeDeps(w);
    const spies = {
      findShare: vi.fn(deps.findShare),
      logAccess: vi.fn(deps.logAccess),
      loadRecord: vi.fn(deps.loadRecord),
      markVerified: vi.fn(deps.markVerified),
    };
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    await handlerFor(w, spies)(post(URL_, valid));
    const everything = JSON.stringify([Object.values(spies).map(s => s.mock.calls), w.log, log.mock.calls, error.mock.calls]);
    expect(everything).not.toContain(TOKEN);
    log.mockRestore();
    error.mockRestore();
  });

  it('answers 503 unavailable with no detail when the database fails', async () => {
    const w = await world();
    const response = await handlerFor(w, { markVerified: async () => { throw new Error('duplicate key "records_pkey"'); } })(post(URL_, valid));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ error: 'unavailable' }));
  });

  it('answers a preflight with CORS headers and no credentials, and 405 for other methods', async () => {
    const w = await world();
    const handler = handlerFor(w);
    const preflight = await handler(new Request(URL_, { method: 'OPTIONS' }));
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(preflight.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect((await handler(new Request(URL_, { method: 'PUT', body: '{}' }))).status).toBe(405);
  });
});
