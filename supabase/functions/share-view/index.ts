// Edge Function entry (Deno). Wires the handler to Supabase; the logic and its tests are
// in handler.ts and index.test.ts. Deployed with verify_jwt = false: clinicians have no
// account. Contract: docs/contracts/share.md.
import { RECORD_COLUMNS, adminClient, rows, shareStore } from '../_shared/db.ts';
import { createHandler } from './handler.ts';

const admin = adminClient();

const handler = createHandler({
  ...shareStore(admin),

  async loadPatient(userId) {
    // Only the four fields a clinician sees are selected.
    return rows<Record<string, unknown> | null>(
      await admin.from('profiles').select('display_name, birth_date, sex, blood_type').eq('id', userId).maybeSingle(),
    );
  },

  async loadRecords(userId, ids) {
    // Stale ids (records deleted after the share was made) simply find nothing.
    return rows<Record<string, unknown>[]>(
      await admin
        .from('records')
        .select(RECORD_COLUMNS)
        .in('id', ids)
        .eq('user_id', userId)
        .order('occurred_on', { ascending: false, nullsFirst: false }),
    );
  },
});

Deno.serve(handler);
