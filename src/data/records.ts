import { trustAfterEdit, trustForNew } from '../domain/trust';
import type { CandidateRecord, HealthRecord, RecordStatus } from '../domain/types';
import { recordFromRow, recordToRow } from './mappers';
import { check, supabase } from './supabase';

export async function listRecords(): Promise<HealthRecord[]> {
  const rows = check(
    await supabase.from('records').select('*').order('occurred_on', { ascending: false, nullsFirst: false }),
    'Could not load records',
  );
  return (rows ?? []).map(recordFromRow);
}

export async function getRecord(id: string): Promise<HealthRecord> {
  const row = check(await supabase.from('records').select('*').eq('id', id).single(), 'Could not load the record');
  return recordFromRow(row);
}

export type NewRecordInput = CandidateRecord & {
  notes: string | null;
  status: RecordStatus;
  source: 'manual' | 'scan';
  documentId: string | null;
  clientId: string;
};

export async function createRecord(input: NewRecordInput): Promise<HealthRecord> {
  const row = {
    id: input.clientId,
    ...recordToRow({
      type: input.type,
      title: input.title,
      occurredOn: input.occurredOn,
      details: input.details,
      providerName: input.providerName,
      notes: input.notes,
      status: input.status,
      trustLevel: trustForNew(input.source),
      documentId: input.documentId,
    }),
  };
  const saved = check(
    await supabase.from('records').upsert(row, { onConflict: 'id' }).select().single(),
    'Could not save the record',
  );
  return recordFromRow(saved);
}

export async function updateRecord(
  before: HealthRecord,
  patch: Partial<Pick<HealthRecord, 'title' | 'occurredOn' | 'details' | 'status' | 'providerName' | 'notes'>>,
): Promise<HealthRecord> {
  const after = {
    title: patch.title ?? before.title,
    occurredOn: patch.occurredOn === undefined ? before.occurredOn : patch.occurredOn,
    details: patch.details ?? before.details,
    status: patch.status ?? before.status,
  };
  const trust = trustAfterEdit(before, after);
  const changes: Partial<HealthRecord> = { ...patch };
  const row = recordToRow(changes);
  if (trust !== before.trustLevel) {
    row.trust_level = trust;
    if (before.trustLevel === 'clinician_verified') {
      row.verified_by = null;
      row.verified_license = null;
      row.verified_at = null;
    }
  }
  const saved = check(
    await supabase.from('records').update(row).eq('id', before.id).select().single(),
    'Could not update the record',
  );
  return recordFromRow(saved);
}

export async function deleteRecord(id: string): Promise<void> {
  check(await supabase.from('records').delete().eq('id', id), 'Could not delete the record');
}
