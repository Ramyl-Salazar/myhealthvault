// Supabase access shared by the share functions (Deno only). The service role bypasses
// row-level security, because a clinician has no account; every query below is scoped
// by hand to one share and its owner. Contract: docs/contracts/share.md.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ShareStore } from './share.ts';

/** The records columns a clinician's HealthRecord is built from, plus user_id for the owner check. */
export const RECORD_COLUMNS =
  'id, user_id, type, title, occurred_on, details, provider_name, notes, status, trust_level, verified_by, verified_license, verified_at, created_at, updated_at';

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Throws a plain Error on a failed query. Callers turn it into 503 with no detail. */
export function rows<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error('query failed');
  return result.data as T;
}

export function shareStore(admin: SupabaseClient): ShareStore {
  return {
    now: () => new Date(),

    async findShare(tokenHash) {
      const data = rows<{ id: string; user_id: string; record_ids: string[]; expires_at: string; revoked_at: string | null } | null>(
        await admin.from('shares').select('id, user_id, record_ids, expires_at, revoked_at').eq('token_hash', tokenHash).maybeSingle(),
      );
      return data
        ? { id: data.id, userId: data.user_id, recordIds: data.record_ids, expiresAt: data.expires_at, revokedAt: data.revoked_at }
        : null;
    },

    async logAccess(entry) {
      rows(await admin.from('share_access_log').insert({
        share_id: entry.shareId,
        action: entry.action,
        record_id: entry.recordId,
        device: entry.device,
      }));
    },
  };
}
