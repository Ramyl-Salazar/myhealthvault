import { beforeEach, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { functions: { invoke } } }));

import { readWithGoogle } from './readWithGoogle';

const candidate = { type: 'diagnosis', title: 'Hypertension', occurredOn: null, providerName: null, details: { kind: 'diagnosis' } };

beforeEach(() => invoke.mockReset());

it('posts the document id to read-document and returns its candidates', async () => {
  invoke.mockResolvedValue({ data: { candidates: [candidate] }, error: null });
  expect(await readWithGoogle('doc-1')).toEqual({ ok: true, candidates: [candidate] });
  expect(invoke).toHaveBeenCalledWith('read-document', { method: 'POST', body: { documentId: 'doc-1' } });
});

it('maps a 429 answer to limit', async () => {
  invoke.mockResolvedValue({ data: null, error: { message: 'error', context: new Response('{"error":"limit"}', { status: 429 }) } });
  expect(await readWithGoogle('doc-1')).toEqual({ ok: false, reason: 'limit' });
});

it('maps a 503 answer to unavailable', async () => {
  invoke.mockResolvedValue({ data: null, error: { message: 'error', context: new Response('{"error":"unavailable"}', { status: 503 }) } });
  expect(await readWithGoogle('doc-1')).toEqual({ ok: false, reason: 'unavailable' });
});

it('maps a network failure or a reply of the wrong shape to unavailable', async () => {
  invoke.mockRejectedValueOnce(new Error('offline'));
  expect(await readWithGoogle('doc-1')).toEqual({ ok: false, reason: 'unavailable' });
  invoke.mockResolvedValueOnce({ data: { candidates: 'none' }, error: null });
  expect(await readWithGoogle('doc-1')).toEqual({ ok: false, reason: 'unavailable' });
});
