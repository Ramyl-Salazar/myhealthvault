// Share token checks on the server. The app makes tokens of 32 random bytes in
// base64url (43 characters) and stores only their SHA-256 hex digest; see
// src/domain/share.ts, which must hash the same way. Contract: docs/contracts/share.md.

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** True for a string that could be a token the app made. Anything else is not looked up. */
export function isTokenShape(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_SHAPE.test(value);
}

/** SHA-256 of the token's UTF-8 bytes, as 64 lowercase hex characters (shares.token_hash). */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
