import { afterEach, expect, it, vi } from 'vitest';
import { loadClinicianShare, verifyClinicianRecord } from './clinician';

afterEach(() => vi.unstubAllGlobals());

it('posts the token in the body and maps 410 to ended', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ status: 410, ok: false });
  vi.stubGlobal('fetch', fetchMock);
  expect(await loadClinicianShare('A'.repeat(43))).toEqual({ ok: false, reason: 'ended' });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: expect.objectContaining({ apikey: expect.any(String) }) });
  expect(fetchMock.mock.calls[0][0]).not.toContain('A'.repeat(43));
  expect(fetchMock.mock.calls[0][1].referrerPolicy).toBe('no-referrer');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: 'A'.repeat(43) });
  expect(await verifyClinicianRecord('A'.repeat(43), 'r1', 'Dr. Reyes', '0098123')).toEqual({ ok: false, reason: 'ended' });
});
