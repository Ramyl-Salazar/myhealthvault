import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRecord } from '../domain/testing';

type Row = Record<string, unknown>;
const store = new Map<string, Row>();
const calls: { op: string; payload?: Row; options?: unknown }[] = [];
let failWith: string | null = null;

function builder(table: string) {
  let pending: Row | null = null;
  let patch: Row | null = null;
  const b: Record<string, unknown> = {};
  b.upsert = (payload: Row, options: unknown) => {
    calls.push({ op: `${table}.upsert`, payload, options });
    const prior = store.get(payload.id as string) ?? {};
    pending = { created_at: 't', updated_at: 't', user_id: 'u1', ...prior, ...payload };
    store.set(payload.id as string, pending);
    return b;
  };
  b.update = (payload: Row) => {
    calls.push({ op: `${table}.update`, payload });
    patch = payload;
    return b;
  };
  b.eq = (_column: string, id: string) => {
    if (patch) {
      pending = { ...(store.get(id) as Row), ...patch };
      store.set(id, pending);
    }
    return b;
  };
  b.select = () => b;
  b.single = () =>
    Promise.resolve(failWith ? { data: null, error: { message: failWith } } : { data: pending, error: null });
  return b;
}

vi.mock('./supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./supabase')>()),
  supabase: { from: (table: string) => builder(table) },
}));

import { createRecord, updateRecord } from './records';

const input = {
  type: 'diagnosis' as const,
  title: 'Asthma',
  occurredOn: '2026-02-01',
  details: { kind: 'diagnosis' as const },
  providerName: null,
  notes: null,
  status: 'active' as const,
  source: 'manual' as const,
  documentId: null,
  clientId: 'client-1',
};

beforeEach(() => {
  store.clear();
  calls.length = 0;
  failWith = null;
});

describe('createRecord', () => {
  it('upserts on id so a retried save yields one row', async () => {
    const first = await createRecord(input);
    const second = await createRecord(input);
    expect(store.size).toBe(1);
    expect(first.id).toBe('client-1');
    expect(second.id).toBe('client-1');
    expect(calls.every((c) => c.op === 'records.upsert')).toBe(true);
    expect(calls[0].options).toMatchObject({ onConflict: 'id' });
  });

  it('sets trust from the source', async () => {
    await createRecord(input);
    expect(calls[0].payload?.trust_level).toBe('patient_entered');
    await createRecord({ ...input, clientId: 'client-2', source: 'scan', documentId: 'd1' });
    expect(calls[1].payload?.trust_level).toBe('document_supported');
    expect(calls[1].payload?.document_id).toBe('d1');
  });

  it('throws a plain Error when Supabase fails', async () => {
    failWith = 'boom';
    await expect(createRecord(input)).rejects.toThrow('Could not save the record: boom');
  });
});

describe('updateRecord', () => {
  const verified = makeRecord({
    id: 'v1',
    title: 'Type 2 diabetes',
    trustLevel: 'clinician_verified',
    verifiedBy: 'Dr. Cruz-Manalo',
    verifiedLicense: '0098765',
    verifiedAt: '2026-01-03T00:00:00Z',
  });

  beforeEach(() => {
    store.set('v1', { id: 'v1', user_id: 'u1', created_at: 't', updated_at: 't' });
  });

  it('drops trust and clears verifier fields when the title changes', async () => {
    await updateRecord(verified, { title: 'Diabetes' });
    expect(calls[0].payload).toMatchObject({
      title: 'Diabetes',
      trust_level: 'patient_entered',
      verified_by: null,
      verified_license: null,
      verified_at: null,
    });
  });

  it('does not send trust_level for a notes-only change', async () => {
    await updateRecord(verified, { notes: 'Taken with food' });
    expect(calls[0].payload).toEqual({ notes: 'Taken with food' });
  });

  it('does not send trust_level for a provider-only change', async () => {
    await updateRecord(verified, { providerName: 'Other clinic' });
    expect(calls[0].payload).toEqual({ provider_name: 'Other clinic' });
  });

  it('lowers trust without verifier fields when the record was not verified', async () => {
    const supported = makeRecord({ id: 'v1', trustLevel: 'document_supported' });
    await updateRecord(supported, { title: 'New' });
    expect(calls[0].payload).toEqual({ title: 'New', trust_level: 'patient_entered' });
  });
});
