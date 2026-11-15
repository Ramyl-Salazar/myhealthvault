// Edge Function entry (Deno). Wires the handler to Supabase; the logic and its tests are
// in handler.ts and index.test.ts. Deployed with verify_jwt = false: clinicians have no
// account. Contract: docs/contracts/share.md.
import { RECORD_COLUMNS, adminClient, rows, shareStore } from '../_shared/db.ts';
import { createHandler } from './handler.ts';

const admin = adminClient();

const handler = createHandler({
  ...shareStore(admin),

  async loadRecord(userId, recordId) {
    return rows<Record<string, unknown> | null>(
      await admin.from('records').select(RECORD_COLUMNS).eq('id', recordId).eq('user_id', userId).maybeSingle(),
    );
  },

  async markVerified({ userId, recordId, verifiedBy, verifiedLicense, verifiedAt }) {
    // One update sets all four fields, so the verifier check constraint always holds.
    // The trust_level filter makes it a compare-and-set: of two concurrent verifies,
    // only one changes the row.
    return rows<Record<string, unknown> | null>(
      await admin
        .from('records')
        .update({ trust_level: 'clinician_verified', verified_by: verifiedBy, verified_license: verifiedLicense, verified_at: verifiedAt })
        .eq('id', recordId)
        .eq('user_id', userId)
        .neq('trust_level', 'clinician_verified')
        .select(RECORD_COLUMNS)
        .maybeSingle(),
    );
  },
});

Deno.serve(handler);
