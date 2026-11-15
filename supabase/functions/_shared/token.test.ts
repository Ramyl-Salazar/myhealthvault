// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { newShareToken } from '../../../src/domain/share';
import { hashToken, isTokenShape } from './token.ts';

describe('share token on the server', () => {
  it('hashes a token to the same SHA-256 hex the app stores', async () => {
    const { token, tokenHash } = await newShareToken();
    expect(await hashToken(token)).toBe(tokenHash);
  });

  it('accepts only 43 base64url characters', () => {
    expect(isTokenShape('A'.repeat(43))).toBe(true);
    expect(isTokenShape('A'.repeat(42))).toBe(false);
    expect(isTokenShape('A'.repeat(44))).toBe(false);
    expect(isTokenShape(`${'A'.repeat(42)}=`)).toBe(false);
    expect(isTokenShape(`${'A'.repeat(42)}/`)).toBe(false);
    expect(isTokenShape(42)).toBe(false);
  });
});
