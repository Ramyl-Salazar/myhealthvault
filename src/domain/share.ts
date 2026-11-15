// Share links: the token, its hash and the link. Contract: docs/contracts/share.md.
// The raw token exists only in the link the patient hands over; the database keeps its
// SHA-256 hash, so a leaked shares table cannot be turned back into working links.

/** How long a share link lasts, in minutes: 15 minutes, 1 hour, 24 hours, 7 days. */
export const DURATIONS = [15, 60, 1440, 10080] as const;
export type ShareMinutes = (typeof DURATIONS)[number];

/** Random bytes in a token: 256 bits, so links cannot be guessed. */
const TOKEN_BYTES = 32;

export interface Share {
  id: string;
  label: string;
  recordIds: string[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface AccessLogEntry {
  id: string;
  action: 'viewed' | 'verified';
  recordId: string | null;
  device: string;
  createdAt: string;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 of the text's UTF-8 bytes, as 64 lowercase hex characters. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** A new random token (43 base64url characters) and the hash that is stored for it. */
export async function newShareToken(): Promise<{ token: string; tokenHash: string }> {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  return { token, tokenHash: await sha256Hex(token) };
}

/**
 * The public link for a token. It uses VITE_PUBLIC_URL, not the page's own origin,
 * because the Android app runs on its own origin, which a clinician cannot open.
 * The origin is only a fallback for a build where VITE_PUBLIC_URL is not set.
 */
export function shareUrl(token: string, base: string | undefined = import.meta.env.VITE_PUBLIC_URL as string | undefined): string {
  const root = (base || globalThis.location?.origin || '').replace(/\/+$/, '');
  return `${root}/s/${token}`;
}

/** Whether a share can still be opened at `now`. Revoked or past its expiry is ended. */
export function shareState(share: Pick<Share, 'expiresAt' | 'revokedAt'>, now: Date): 'active' | 'ended' {
  if (share.revokedAt !== null) return 'ended';
  const expires = Date.parse(share.expiresAt);
  return Number.isFinite(expires) && expires > now.getTime() ? 'active' : 'ended';
}
