// @vitest-environment node
// Tests for the read-document Edge Function. The handler takes its database, storage
// and Gemini access as injected dependencies, so nothing here reaches the network.
import { describe, expect, it, vi } from 'vitest';
import { createHandler, MAX_IMAGE_BYTES, USER_READ_LIMIT, type ReadDocumentDeps } from './handler.ts';
import { PROMPT, requestGemini } from './prompt.ts';
import { parseCandidates } from './schema.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MY_DOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_DOC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TODAY = '2026-11-16';

const validReply = {
  candidates: [
    {
      type: 'medication',
      title: 'Metformin',
      occurredOn: '2026-11-02',
      providerName: 'Dr. Aurora Lim',
      details: { kind: 'medication', genericName: null, dose: '500 mg', frequency: 'twice daily', startOn: null, endOn: null },
    },
  ],
};

interface World {
  userReads: Map<string, number>;
  dayReads: Map<string, number>;
  documents: Map<string, { userId: string; storagePath: string }>;
  image: Blob;
}

function world(overrides: Partial<World> = {}): World {
  return {
    userReads: new Map([[ME, 0], [OTHER, 0]]),
    dayReads: new Map(),
    documents: new Map([
      [MY_DOC, { userId: ME, storagePath: `${ME}/${MY_DOC}.jpg` }],
      [OTHER_DOC, { userId: OTHER, storagePath: `${OTHER}/${OTHER_DOC}.jpg` }],
    ]),
    image: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    ...overrides,
  };
}

// Every counter call yields to the event loop first, so concurrent requests interleave
// between reading a count and writing it, the way two Edge Function calls would.
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function deps(w: World, overrides: Partial<ReadDocumentDeps> = {}) {
  const readImage = vi.fn(async () => validReply as unknown);
  const d: ReadDocumentDeps = {
    apiKey: 'test-key',
    model: 'test-model',
    dailyCap: 100,
    today: () => TODAY,
    userId: async header => (header === `Bearer token-${ME}` ? ME : header === `Bearer token-${OTHER}` ? OTHER : null),
    findDocument: async (userId, documentId) => {
      const doc = w.documents.get(documentId);
      return doc && doc.userId === userId ? { storagePath: doc.storagePath } : null;
    },
    downloadImage: async () => w.image,
    counters: {
      userReads: async userId => { await tick(); return w.userReads.get(userId) ?? null; },
      swapUserReads: async (userId, from, to) => {
        await tick();
        if (w.userReads.get(userId) !== from) return false;
        w.userReads.set(userId, to);
        return true;
      },
      dayReads: async day => { await tick(); if (!w.dayReads.has(day)) w.dayReads.set(day, 0); return w.dayReads.get(day)!; },
      swapDayReads: async (day, from, to) => {
        await tick();
        if (w.dayReads.get(day) !== from) return false;
        w.dayReads.set(day, to);
        return true;
      },
    },
    readImage,
    ...overrides,
  };
  return { d, readImage: (overrides.readImage ?? readImage) as ReturnType<typeof vi.fn> };
}

function post(documentId: string, user = ME, init: Partial<RequestInit> = {}) {
  return new Request('http://localhost/functions/v1/read-document', {
    method: 'POST',
    headers: { Authorization: `Bearer token-${user}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId }),
    ...init,
  });
}

describe('read-document handler', () => {
  it('returns the candidates of a valid reply and counts the read once on each counter', async () => {
    const w = world();
    const { d, readImage } = deps(w);
    const response = await createHandler(d)(post(MY_DOC));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ candidates: validReply.candidates });
    expect(readImage).toHaveBeenCalledTimes(1);
    expect(readImage.mock.calls[0][0]).toMatchObject({ apiKey: 'test-key', model: 'test-model', mimeType: 'image/jpeg' });
    expect(w.userReads.get(ME)).toBe(1);
    expect(w.dayReads.get(TODAY)).toBe(1);
  });

  it("answers 404 for another user's document and calls nothing", async () => {
    const w = world();
    const { d, readImage } = deps(w);
    const response = await createHandler(d)(post(OTHER_DOC));
    expect(response.status).toBe(404);
    expect(readImage).not.toHaveBeenCalled();
    expect(w.userReads.get(ME)).toBe(0);
    expect(w.dayReads.get(TODAY)).toBeUndefined();
  });

  it('answers 404 for a document id that is not a uuid', async () => {
    const { d } = deps(world());
    expect((await createHandler(d)(post('not-an-id'))).status).toBe(404);
  });

  it('answers 429 limit on the sixth read by one account', async () => {
    const w = world();
    const { d, readImage } = deps(w);
    const handler = createHandler(d);
    for (let read = 0; read < USER_READ_LIMIT; read++) expect((await handler(post(MY_DOC))).status).toBe(200);
    const sixth = await handler(post(MY_DOC));
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: 'limit' });
    expect(readImage).toHaveBeenCalledTimes(USER_READ_LIMIT);
    expect(w.userReads.get(ME)).toBe(USER_READ_LIMIT);
  });

  it('answers 429 limit when the daily cap is reached and gives the account read back', async () => {
    const w = world({ dayReads: new Map([[TODAY, 3]]) });
    const { d, readImage } = deps(w, { dailyCap: 3 });
    const response = await createHandler(d)(post(MY_DOC));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'limit' });
    expect(readImage).not.toHaveBeenCalled();
    expect(w.userReads.get(ME)).toBe(0);
    expect(w.dayReads.get(TODAY)).toBe(3);
  });

  it('cannot be raced past the account limit', async () => {
    const w = world({ userReads: new Map([[ME, USER_READ_LIMIT - 1]]) });
    const { d, readImage } = deps(w);
    const handler = createHandler(d);
    const responses = await Promise.all([handler(post(MY_DOC)), handler(post(MY_DOC)), handler(post(MY_DOC))]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 429, 429]);
    expect(readImage).toHaveBeenCalledTimes(1);
    expect(w.userReads.get(ME)).toBe(USER_READ_LIMIT);
  });

  it('cannot be raced past the daily cap', async () => {
    const w = world({ dayReads: new Map([[TODAY, 1]]) });
    const { d, readImage } = deps(w, { dailyCap: 2 });
    const handler = createHandler(d);
    const responses = await Promise.all([handler(post(MY_DOC, ME)), handler(post(OTHER_DOC, OTHER))]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 429]);
    expect(readImage).toHaveBeenCalledTimes(1);
    expect(w.dayReads.get(TODAY)).toBe(2);
    expect((w.userReads.get(ME) ?? 0) + (w.userReads.get(OTHER) ?? 0)).toBe(1);
  });

  it('answers 503 unavailable when there is no API key and counts nothing', async () => {
    const w = world();
    const { d, readImage } = deps(w, { apiKey: undefined });
    const response = await createHandler(d)(post(MY_DOC));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
    expect(readImage).not.toHaveBeenCalled();
    expect(w.userReads.get(ME)).toBe(0);
  });

  it('answers 503 unavailable when Google fails', async () => {
    const { d } = deps(world(), { readImage: vi.fn(async () => { throw new Error('quota'); }) });
    const response = await createHandler(d)(post(MY_DOC));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });

  it('answers 401 without a signed-in user', async () => {
    const { d, readImage } = deps(world());
    const response = await createHandler(d)(post(MY_DOC, ME, { headers: { 'Content-Type': 'application/json' } }));
    expect(response.status).toBe(401);
    expect(readImage).not.toHaveBeenCalled();
  });

  it('answers 413 for an image over 10 MB and counts nothing', async () => {
    const w = world({ image: new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: 'image/jpeg' }) });
    const { d, readImage } = deps(w);
    const response = await createHandler(d)(post(MY_DOC));
    expect(response.status).toBe(413);
    expect(readImage).not.toHaveBeenCalled();
    expect(w.userReads.get(ME)).toBe(0);
  });

  it('answers 415 for a stored file that is not an image', async () => {
    const w = world({ image: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) });
    w.documents.set(MY_DOC, { userId: ME, storagePath: `${ME}/${MY_DOC}.pdf` });
    const { d, readImage } = deps(w);
    expect((await createHandler(d)(post(MY_DOC))).status).toBe(415);
    expect(readImage).not.toHaveBeenCalled();
  });

  it('answers 400 for a body without a document id', async () => {
    const { d } = deps(world());
    const response = await createHandler(d)(post(MY_DOC, ME, { body: '{}' }));
    expect(response.status).toBe(400);
  });

  it('answers a preflight request with CORS headers', async () => {
    const { d } = deps(world());
    const response = await createHandler(d)(new Request('http://localhost/functions/v1/read-document', { method: 'OPTIONS' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
  });

  it('drops a candidate with an unknown type and keeps the valid one', async () => {
    const reply = { candidates: [{ ...validReply.candidates[0], type: 'surgery_note', details: { kind: 'surgery_note' } }, validReply.candidates[0]] };
    const { d } = deps(world(), { readImage: vi.fn(async () => reply) });
    const response = await createHandler(d)(post(MY_DOC));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ candidates: validReply.candidates });
  });
});

describe('parseCandidates', () => {
  it('drops a candidate whose details kind does not match its type', () => {
    expect(parseCandidates({ candidates: [{ type: 'allergy', title: 'Penicillin', occurredOn: null, providerName: null, details: { kind: 'medication' } }] })).toEqual([]);
  });

  it('drops a candidate without a readable title', () => {
    expect(parseCandidates({ candidates: [{ type: 'diagnosis', title: null, occurredOn: null, providerName: null, details: { kind: 'diagnosis' } }] })).toEqual([]);
  });

  it('keeps copied text as written and turns values that do not fit into null', () => {
    const [candidate] = parseCandidates({
      candidates: [{
        type: 'allergy', title: 'Penicillin', occurredOn: '03/12/2024', providerName: 42, extra: 'ignored',
        details: { kind: 'allergy', reaction: 'Hives', severity: 'very bad' },
      }],
    });
    expect(candidate).toEqual({ type: 'allergy', title: 'Penicillin', occurredOn: null, providerName: null, details: { kind: 'allergy', reaction: 'Hives', severity: null } });
  });

  it('keeps only lab results with a name and a value, and drops a lab record left empty', () => {
    const parsed = parseCandidates({
      candidates: [
        { type: 'lab_result', title: 'Blood chemistry', occurredOn: '2026-10-01', providerName: null, details: { kind: 'lab_result', results: [
          { name: 'HbA1c', value: '7.2', unit: '%', referenceRange: '4.0-5.6' },
          { name: 'Glucose', value: 110, unit: 'mg/dL', referenceRange: null },
        ] } },
        { type: 'lab_result', title: 'Lipids', occurredOn: null, providerName: null, details: { kind: 'lab_result', results: [{ name: 'LDL', value: null }] } },
      ],
    });
    expect(parsed).toEqual([{ type: 'lab_result', title: 'Blood chemistry', occurredOn: '2026-10-01', providerName: null, details: { kind: 'lab_result', results: [{ name: 'HbA1c', value: '7.2', unit: '%', referenceRange: '4.0-5.6' }] } }]);
  });

  it('returns nothing for a reply that is not the expected object', () => {
    expect(parseCandidates('Here is the record')).toEqual([]);
    expect(parseCandidates(null)).toEqual([]);
    expect(parseCandidates({ candidates: 'none' })).toEqual([]);
  });

  it('rejects an impossible calendar date', () => {
    const [candidate] = parseCandidates({ candidates: [{ type: 'visit', title: 'Check-up', occurredOn: '2026-02-30', providerName: null, details: { kind: 'visit', reason: null, followUpOn: '2026-12-01' } }] });
    expect(candidate.occurredOn).toBeNull();
    expect(candidate.details).toEqual({ kind: 'visit', reason: null, followUpOn: '2026-12-01' });
  });
});

describe('prompt and Gemini request', () => {
  it('tells the model to copy exactly, use null for anything unreadable and answer in JSON only', () => {
    expect(PROMPT).toContain('Copy text exactly as written');
    expect(PROMPT).toContain('null');
    expect(PROMPT).toContain('JSON');
    expect(PROMPT).toContain('Never guess');
  });

  it('sends the key in a header, the image inline, and parses the JSON reply', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(validReply) }] } }],
    }), { status: 200 }));
    const result = await requestGemini(fetchFn, { apiKey: 'secret', model: 'gemini-test', image: new Uint8Array([1, 2, 3]), mimeType: 'image/png' });
    expect(result).toEqual(validReply);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(url).not.toContain('secret');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('secret');
    const body = JSON.parse(String(init?.body));
    expect(body.contents[0].parts).toContainEqual({ inline_data: { mime_type: 'image/png', data: 'AQID' } });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('throws when Google answers with an error', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 429 }));
    await expect(requestGemini(fetchFn, { apiKey: 'k', model: 'm', image: new Uint8Array([1]), mimeType: 'image/jpeg' })).rejects.toThrow();
  });
});
