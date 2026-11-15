// @vitest-environment node
// Tests for the share-view Edge Function. Database access is injected, so nothing here
// reaches the network. Contract: docs/contracts/share.md.
import { describe, expect, it, vi } from 'vitest';
import { MAX_BODY_BYTES } from '../_shared/share.ts';
import { OWNER, REC_A, REC_B, SHARE_ID, TOKEN, post, storeDeps, world, type World } from '../_shared/testing.ts';
import { createHandler, type ShareViewDeps } from './handler.ts';

const URL_ = 'http://localhost/functions/v1/share-view';

function handlerFor(w: World, overrides: Partial<ShareViewDeps> = {}) {
  const deps: ShareViewDeps = { ...storeDeps(w), ...overrides };
  return createHandler(deps);
}

const ENDED = { error: 'ended' };

describe('share-view handler', () => {
  it('returns the patient, only the shared records of the owner, and the expiry, and logs one view', async () => {
    const w = await world();
    const response = await handlerFor(w)(post(URL_, { token: TOKEN }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.expiresAt).toBe('2026-11-16T11:00:00Z');
    expect(body.patient).toEqual({ displayName: 'Lourdes Villareal', birthDate: '1968-03-12', sex: 'female', bloodType: 'O+' });
    expect(body.records.map((r: { id: string }) => r.id).sort()).toEqual([REC_A, REC_B].sort());
    expect(w.log).toEqual([{ shareId: SHARE_ID, action: 'viewed', recordId: null, device: 'TestBrowser/1.0 (Android 15)' }]);
  });

  it('returns records in the HealthRecord shape with no owner id, document link or internal columns', async () => {
    const w = await world();
    const body = await (await handlerFor(w)(post(URL_, { token: TOKEN }))).json();
    const record = body.records.find((r: { id: string }) => r.id === REC_B);
    expect(Object.keys(record).sort()).toEqual([
      'createdAt', 'details', 'documentId', 'id', 'notes', 'occurredOn', 'providerName', 'status', 'title', 'trustLevel',
      'type', 'updatedAt', 'userId', 'verifiedAt', 'verifiedBy', 'verifiedLicense',
    ]);
    expect(record).toMatchObject({ type: 'allergy', title: 'Penicillin', details: { kind: 'allergy', reaction: 'Rash', severity: 'moderate' }, trustLevel: 'patient_entered' });
    expect(record.userId).toBe('');
    expect(record.documentId).toBeNull();
    const text = JSON.stringify(body);
    expect(text).not.toContain(OWNER);
    expect(text).not.toContain('secret.jpg');
    expect(text).not.toContain('internal');
  });

  it('sends no profile column beyond the four patient fields', async () => {
    const w = await world();
    const body = await (await handlerFor(w)(post(URL_, { token: TOKEN }))).json();
    const text = JSON.stringify(body);
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'patient', 'records']);
    expect(Object.keys(body.patient).sort()).toEqual(['birthDate', 'bloodType', 'displayName', 'sex']);
    expect(text).not.toContain('Ramon');
    expect(text).not.toContain('gemini');
    expect(text).not.toContain('emergency');
  });

  it("drops a row of another user or outside the share even if the query returned it", async () => {
    const w = await world();
    const leaky = vi.fn(async () => w.records.map(r => ({ ...r })));
    const body = await (await handlerFor(w, { loadRecords: leaky })(post(URL_, { token: TOKEN }))).json();
    expect(body.records.map((r: { id: string }) => r.id).sort()).toEqual([REC_A, REC_B].sort());
  });

  it('answers 410 ended for an expired link and logs nothing', async () => {
    const w = await world();
    w.now = new Date('2026-11-16T11:00:00Z');
    const response = await handlerFor(w)(post(URL_, { token: TOKEN }));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual(ENDED);
    expect(w.log).toEqual([]);
  });

  it('answers 410 ended for a revoked link and logs nothing', async () => {
    const w = await world();
    for (const share of w.shares.values()) share.revokedAt = '2026-11-16T09:59:00Z';
    const response = await handlerFor(w)(post(URL_, { token: TOKEN }));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual(ENDED);
    expect(w.log).toEqual([]);
  });

  it('answers an unknown or malformed token with the same 410 body and headers as an ended one', async () => {
    const w = await world();
    const handler = handlerFor(w);
    const unknown = await handler(post(URL_, { token: 'A'.repeat(43) }));
    const malformed = await handler(post(URL_, { token: 'not a token' }));
    for (const share of w.shares.values()) share.revokedAt = '2026-11-16T09:59:00Z';
    const revoked = await handler(post(URL_, { token: TOKEN }));
    const bodies = await Promise.all([unknown, malformed, revoked].map(r => r.text()));
    expect([unknown.status, malformed.status, revoked.status]).toEqual([410, 410, 410]);
    expect(new Set(bodies)).toEqual(new Set([JSON.stringify(ENDED)]));
    expect([...unknown.headers.entries()]).toEqual([...revoked.headers.entries()]);
  });

  it('looks the share up by hash and never passes or logs the raw token', async () => {
    const w = await world();
    const deps = storeDeps(w);
    const spies = {
      findShare: vi.fn(deps.findShare),
      logAccess: vi.fn(deps.logAccess),
      loadPatient: vi.fn(deps.loadPatient),
      loadRecords: vi.fn(deps.loadRecords),
    };
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    await handlerFor(w, spies)(post(URL_, { token: TOKEN }));
    expect(spies.findShare.mock.calls[0][0]).toMatch(/^[0-9a-f]{64}$/);
    const everything = JSON.stringify([Object.values(spies).map(s => s.mock.calls), w.log, log.mock.calls, error.mock.calls]);
    expect(everything).not.toContain(TOKEN);
    log.mockRestore();
    error.mockRestore();
  });

  it('logs the user agent cut to 200 characters, without control characters', async () => {
    const w = await world();
    await handlerFor(w)(post(URL_, { token: TOKEN }, { 'User-Agent': `Agent\t${'x'.repeat(400)}` }));
    expect(w.log[0].device).toHaveLength(200);
    expect(w.log[0].device).not.toMatch(/[\u0000-\u001f]/);
  });

  it('logs an empty device when there is no user agent', async () => {
    const w = await world();
    const request = new Request(URL_, { method: 'POST', body: JSON.stringify({ token: TOKEN }) });
    await handlerFor(w)(request);
    expect(w.log[0].device).toBe('');
  });

  it('answers 400 for a body that is not a JSON object with a string token', async () => {
    const w = await world();
    const handler = handlerFor(w);
    for (const body of ['not json', '[]', 'null', JSON.stringify({ token: 42 }), JSON.stringify({})]) {
      const response = await handler(post(URL_, body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'bad_request' });
    }
    expect(w.log).toEqual([]);
  });

  it('answers 413 for a body over the size cap without parsing it', async () => {
    const w = await world();
    const response = await handlerFor(w)(post(URL_, JSON.stringify({ token: TOKEN, pad: 'x'.repeat(MAX_BODY_BYTES) })));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'too_large' });
    expect(w.log).toEqual([]);
  });

  it('answers 503 unavailable with no detail when the database fails, and serves nothing unlogged', async () => {
    const w = await world();
    const failing = await handlerFor(w, { loadRecords: async () => { throw new Error('relation "records" password=abc'); } })(post(URL_, { token: TOKEN }));
    expect(failing.status).toBe(503);
    expect(await failing.text()).toBe(JSON.stringify({ error: 'unavailable' }));
    const unlogged = await handlerFor(w, { logAccess: async () => { throw new Error('insert failed'); } })(post(URL_, { token: TOKEN }));
    expect(unlogged.status).toBe(503);
    expect(await unlogged.text()).toBe(JSON.stringify({ error: 'unavailable' }));
  });

  it('answers a preflight from any origin without allowing credentials', async () => {
    const w = await world();
    const response = await handlerFor(w)(new Request(URL_, { method: 'OPTIONS', headers: { Origin: 'https://myhealthvault.example' } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });

  it('marks every answer as not cacheable and answers 405 for other methods', async () => {
    const w = await world();
    const handler = handlerFor(w);
    expect((await handler(post(URL_, { token: TOKEN }))).headers.get('Cache-Control')).toBe('no-store');
    const get = await handler(new Request(`${URL_}?token=${TOKEN}`));
    expect(get.status).toBe(405);
    expect(w.log).toHaveLength(1);
  });
});
