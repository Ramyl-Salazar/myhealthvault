import { describe, expect, it } from 'vitest';
import { DURATIONS, newShareToken, sha256Hex, shareUrl, shareState } from './share';

describe('newShareToken', () => {
  it('makes a 43-character base64url token from 32 random bytes, different each call', async () => {
    const first = await newShareToken();
    const second = await newShareToken();
    expect(first.token).toHaveLength(43);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.token).not.toBe(first.token);
  });

  it('hashes the token with SHA-256 into 64 lowercase hex characters', async () => {
    const { token, tokenHash } = await newShareToken();
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(await sha256Hex(token));
    expect(tokenHash).not.toContain(token);
  });
});

describe('sha256Hex', () => {
  it('matches the known SHA-256 digest of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('shareUrl', () => {
  it('ends with /s/<token>', () => {
    expect(shareUrl('abc')).toMatch(/\/s\/abc$/);
  });

  it('builds on the public site address without a doubled slash', () => {
    expect(shareUrl('abc', 'https://myhealthvault.example/')).toBe('https://myhealthvault.example/s/abc');
    expect(shareUrl('abc', 'https://myhealthvault.example')).toBe('https://myhealthvault.example/s/abc');
  });
});

describe('DURATIONS', () => {
  it('offers 15 minutes, 1 hour, 24 hours and 7 days', () => {
    expect(DURATIONS).toEqual([15, 60, 1440, 10080]);
  });
});

describe('shareState', () => {
  const now = new Date('2026-11-16T10:00:00Z');
  const share = { expiresAt: '2026-11-16T11:00:00Z', revokedAt: null };

  it('is active before expiry and not revoked', () => {
    expect(shareState(share, now)).toBe('active');
  });

  it('is ended at or after expiry', () => {
    expect(shareState({ ...share, expiresAt: '2026-11-16T10:00:00Z' }, now)).toBe('ended');
  });

  it('is ended once revoked, even before expiry', () => {
    expect(shareState({ ...share, revokedAt: '2026-11-16T09:00:00Z' }, now)).toBe('ended');
  });
});
