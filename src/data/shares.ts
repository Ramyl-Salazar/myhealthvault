import { DURATIONS, newShareToken, shareUrl, type AccessLogEntry, type Share, type ShareMinutes } from '../domain/share';
import { check, supabase } from './supabase';

// Share links, read and written with the signed-in client under row-level security.
// Only the token's hash is stored; the raw token leaves this module inside the link only.
// Contract: docs/contracts/share.md.

const MAX_LABEL_LENGTH = 200;
const SHARE_COLUMNS = 'id, label, record_ids, expires_at, revoked_at, created_at';
const LOG_COLUMNS = 'id, action, record_id, device, created_at';

type Row = Record<string, unknown>;

function shareFromRow(row: Row): Share {
  return {
    id: row.id as string,
    label: (row.label as string | null) ?? '',
    recordIds: (row.record_ids as string[] | null) ?? [],
    expiresAt: row.expires_at as string,
    revokedAt: (row.revoked_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function logEntryFromRow(row: Row): AccessLogEntry {
  return {
    id: row.id as string,
    action: row.action as AccessLogEntry['action'],
    recordId: (row.record_id as string | null) ?? null,
    device: (row.device as string | null) ?? '',
    createdAt: row.created_at as string,
  };
}

export interface NewShareInput {
  label: string;
  recordIds: string[];
  minutes: ShareMinutes;
}

/**
 * Creates a share and returns its link. The link holds the only copy of the token:
 * it cannot be rebuilt later from listShares, so show it to the patient now.
 */
export async function createShare(input: NewShareInput): Promise<{ id: string; url: string; expiresAt: string }> {
  const recordIds = [...new Set(input.recordIds)];
  const label = input.label.trim();
  if (recordIds.length === 0) throw new Error('A share needs at least one record');
  if (!(DURATIONS as readonly number[]).includes(input.minutes)) throw new Error('Unknown share duration');
  if (label.length > MAX_LABEL_LENGTH) throw new Error('The share name is too long');

  const { token, tokenHash } = await newShareToken();
  const expiresAt = new Date(Date.now() + input.minutes * 60_000).toISOString();
  const row = check(
    await supabase
      .from('shares')
      .insert({ label, record_ids: recordIds, token_hash: tokenHash, expires_at: expiresAt })
      .select('id, expires_at')
      .single(),
    'Could not create the share',
  ) as Row;
  return { id: row.id as string, url: shareUrl(token), expiresAt: row.expires_at as string };
}

/** The signed-in user's shares, newest first. */
export async function listShares(): Promise<Share[]> {
  const rows = check(
    await supabase.from('shares').select(SHARE_COLUMNS).order('created_at', { ascending: false }),
    'Could not load shares',
  ) as Row[] | null;
  return (rows ?? []).map(shareFromRow);
}

/** Who opened a share and what they verified, newest first. */
export async function getShareLog(shareId: string): Promise<AccessLogEntry[]> {
  const rows = check(
    await supabase.from('share_access_log').select(LOG_COLUMNS).eq('share_id', shareId).order('created_at', { ascending: false }),
    'Could not load the share log',
  ) as Row[] | null;
  return (rows ?? []).map(logEntryFromRow);
}

/** Ends a share now. Revoking a share that is already revoked changes nothing. */
export async function revokeShare(id: string): Promise<void> {
  check(
    await supabase.from('shares').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null),
    'Could not stop sharing',
  );
}
