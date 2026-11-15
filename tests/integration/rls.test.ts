// Row-level security, storage and seed tests against the real Supabase project.
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (environment or a local .env),
// the migrations in supabase/migrations applied, and anonymous sign-ins enabled.
// Without the two variables the whole suite is skipped.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readDotEnv(): Record<string, string> {
  const file = resolve(process.cwd(), '.env');
  if (!existsSync(file)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const dotEnv = readDotEnv();
const url = process.env.VITE_SUPABASE_URL || dotEnv.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || dotEnv.VITE_SUPABASE_ANON_KEY || '';
const configured = url !== '' && anonKey !== '';

const SKIP_MESSAGE =
  'Skipping database integration tests: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set (environment or .env).';

if (!configured) {
  process.stderr.write(`\n${SKIP_MESSAGE}\n\n`);
  it.skip(SKIP_MESSAGE, () => {});
}

const RECORD_TYPES = ['diagnosis', 'allergy', 'medication', 'lab_result', 'immunization', 'procedure', 'visit'];
const TRUST_LEVELS = ['patient_entered', 'document_supported', 'clinician_verified'];
// Smallest bytes that start like a JPEG. Storage checks the declared content type, not the pixels.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

function newClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface Visitor {
  client: SupabaseClient;
  userId: string;
  storagePaths: string[];
}

async function signInVisitor(): Promise<Visitor> {
  const client = newClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`Anonymous sign-in failed: ${error?.message ?? 'no user'}`);
  return { client, userId: data.user.id, storagePaths: [] };
}

async function cleanUp(visitor: Visitor | undefined): Promise<void> {
  if (!visitor) return;
  if (visitor.storagePaths.length > 0) {
    await visitor.client.storage.from('documents').remove(visitor.storagePaths);
  }
  await visitor.client.rpc('delete_my_data');
  await visitor.client.auth.signOut();
}

async function seed(visitor: Visitor): Promise<void> {
  const { error } = await visitor.client.rpc('seed_demo_data');
  if (error) throw new Error(`seed_demo_data failed: ${error.message}`);
}

async function ownRecords(visitor: Visitor) {
  const { data, error } = await visitor.client.from('records').select('*');
  if (error) throw new Error(`select records failed: ${error.message}`);
  return data as { id: string; user_id: string; type: string; trust_level: string; details: { kind: string } }[];
}

function randomHex64(): string {
  return (randomUUID() + randomUUID()).replace(/-/g, '');
}

describe.skipIf(!configured)('database access rules', () => {
  let a: Visitor;
  let b: Visitor;
  let aRecordId: string;
  let aShareId: string;
  let aPath: string;
  let aDocumentId: string;

  beforeAll(async () => {
    a = await signInVisitor();
    b = await signInVisitor();
    await seed(a);

    const records = await ownRecords(a);
    aRecordId = records[0].id;

    const share = await a.client
      .from('shares')
      .insert({
        user_id: a.userId,
        label: 'Integration test',
        record_ids: [aRecordId],
        token_hash: randomHex64(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    if (share.error) throw new Error(`insert share failed: ${share.error.message}`);
    aShareId = share.data.id as string;

    const documentId = randomUUID();
    aPath = `${a.userId}/${documentId}.jpg`;
    const upload = await a.client.storage
      .from('documents')
      .upload(aPath, new Blob([JPEG_BYTES], { type: 'image/jpeg' }), { contentType: 'image/jpeg' });
    if (upload.error) throw new Error(`upload failed: ${upload.error.message}`);
    a.storagePaths.push(aPath);

    aDocumentId = documentId;
    const documentRow = await a.client
      .from('documents')
      .insert({ id: documentId, user_id: a.userId, storage_path: aPath, kind: 'prescription' });
    if (documentRow.error) throw new Error(`insert document failed: ${documentRow.error.message}`);
  }, 30_000);

  afterAll(async () => {
    await cleanUp(a);
    await cleanUp(b);
  }, 30_000);

  // records
  it("B cannot read A's records", async () => {
    const { data, error } = await b.client.from('records').select().eq('user_id', a.userId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
    const byId = await b.client.from('records').select().eq('id', aRecordId);
    expect(byId.data).toHaveLength(0);
  });

  it("B cannot update A's record", async () => {
    const { data } = await b.client.from('records').update({ title: 'x' }).eq('id', aRecordId).select();
    expect(data).toHaveLength(0);
    const after = await a.client.from('records').select('title').eq('id', aRecordId).single();
    expect(after.data?.title).not.toBe('x');
  });

  it("B cannot delete A's record", async () => {
    const { data } = await b.client.from('records').delete().eq('id', aRecordId).select();
    expect(data).toHaveLength(0);
    const after = await a.client.from('records').select('id').eq('id', aRecordId);
    expect(after.data).toHaveLength(1);
  });

  it("B cannot insert a record owned by A", async () => {
    const { error } = await b.client.from('records').insert({
      user_id: a.userId,
      type: 'diagnosis',
      title: 'Planted',
      details: { kind: 'diagnosis' },
    });
    expect(error).not.toBeNull();
  });

  it('B cannot move its own record to A', async () => {
    const own = await b.client
      .from('records')
      .insert({ type: 'diagnosis', title: 'Own record', details: { kind: 'diagnosis' } })
      .select('id')
      .single();
    expect(own.error).toBeNull();
    const moved = await b.client.from('records').update({ user_id: a.userId }).eq('id', own.data?.id).select();
    expect(moved.error).not.toBeNull();
  });

  it('a client cannot mark its own record as clinician verified', async () => {
    const inserted = await a.client.from('records').insert({
      type: 'diagnosis',
      title: 'Self verified',
      details: { kind: 'diagnosis' },
      trust_level: 'clinician_verified',
      verified_by: 'Someone',
      verified_license: '0000000',
      verified_at: new Date().toISOString(),
    });
    expect(inserted.error).not.toBeNull();
  });

  it('a client cannot update its own record to clinician verified', async () => {
    const target = await a.client
      .from('records')
      .select('id')
      .eq('trust_level', 'patient_entered')
      .limit(1)
      .single();
    expect(target.error).toBeNull();
    const updated = await a.client
      .from('records')
      .update({
        trust_level: 'clinician_verified',
        verified_by: 'Someone',
        verified_license: '0000000',
        verified_at: new Date().toISOString(),
      })
      .eq('id', target.data?.id)
      .select();
    expect(updated.error).not.toBeNull();
    const after = await a.client.from('records').select('trust_level').eq('id', target.data?.id).single();
    expect(after.data?.trust_level).toBe('patient_entered');
  });

  // verified records: clinical fields cannot change while the verification stays
  it('editing the dose of a verified record without dropping trust is rejected', async () => {
    const losartan = await a.client
      .from('records')
      .select('id, details, trust_level')
      .eq('title', 'Losartan')
      .single();
    expect(losartan.data?.trust_level).toBe('clinician_verified');
    const changed = { ...(losartan.data?.details as Record<string, unknown>), dose: '500 mg' };
    const { error } = await a.client.from('records').update({ details: changed }).eq('id', losartan.data?.id).select();
    expect(error).not.toBeNull();
    const after = await a.client.from('records').select('details').eq('id', losartan.data?.id).single();
    expect((after.data?.details as { dose: string }).dose).toBe('50 mg');
  });

  it('editing only the notes of a verified record keeps the verification', async () => {
    const losartan = await a.client.from('records').select('id').eq('title', 'Losartan').single();
    const { data, error } = await a.client
      .from('records')
      .update({ notes: 'Take with breakfast' })
      .eq('id', losartan.data?.id)
      .select('notes, trust_level, verified_by');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ notes: 'Take with breakfast', trust_level: 'clinician_verified' });
    expect(data?.[0].verified_by).not.toBeNull();
  });

  it('editing the title of a verified record succeeds when trust drops and the verifier is cleared', async () => {
    const cataract = await a.client
      .from('records')
      .select('id, trust_level')
      .eq('title', 'Cataract surgery, right eye')
      .single();
    expect(cataract.data?.trust_level).toBe('clinician_verified');
    const { data, error } = await a.client
      .from('records')
      .update({
        title: 'Cataract surgery, left eye',
        trust_level: 'patient_entered',
        verified_by: null,
        verified_license: null,
        verified_at: null,
      })
      .eq('id', cataract.data?.id)
      .select('title, trust_level, verified_by, verified_license, verified_at');
    expect(error).toBeNull();
    expect(data?.[0]).toEqual({
      title: 'Cataract surgery, left eye',
      trust_level: 'patient_entered',
      verified_by: null,
      verified_license: null,
      verified_at: null,
    });
  });

  it("B cannot link its record to A's document", async () => {
    const own = await b.client
      .from('records')
      .insert({ type: 'diagnosis', title: 'Own linked record', details: { kind: 'diagnosis' } })
      .select('id')
      .single();
    expect(own.error).toBeNull();
    const linked = await b.client.from('records').update({ document_id: aDocumentId }).eq('id', own.data?.id).select();
    expect(linked.error).not.toBeNull();
    const inserted = await b.client.from('records').insert({
      type: 'diagnosis',
      title: 'Planted link',
      details: { kind: 'diagnosis' },
      document_id: aDocumentId,
    });
    expect(inserted.error).not.toBeNull();
  });

  it('a client with no session gets no records', async () => {
    const nobody = newClient();
    const { data, error } = await nobody.from('records').select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    expect(data ?? []).toHaveLength(0);
  });

  // profiles
  it("B cannot read A's profile", async () => {
    const { data } = await b.client.from('profiles').select().eq('id', a.userId);
    expect(data).toHaveLength(0);
  });

  it('a client cannot change its own keep flag or read count', async () => {
    const keep = await a.client.from('profiles').update({ keep: true }).eq('id', a.userId);
    expect(keep.error).not.toBeNull();
    const reads = await a.client.from('profiles').update({ gemini_reads: 0 }).eq('id', a.userId);
    expect(reads.error).not.toBeNull();
    const name = await a.client.from('profiles').update({ display_name: 'Lourdes Villareal' }).eq('id', a.userId);
    expect(name.error).toBeNull();
  });

  // shares and the access log
  it("B cannot read A's shares", async () => {
    const { data } = await b.client.from('shares').select().eq('id', aShareId);
    expect(data).toHaveLength(0);
  });

  it("B cannot put A's record in its own share", async () => {
    const { error } = await b.client.from('shares').insert({
      user_id: b.userId,
      label: 'Stolen',
      record_ids: [aRecordId],
      token_hash: randomHex64(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it('a client cannot insert into share_access_log', async () => {
    const { error } = await a.client.from('share_access_log').insert({ share_id: aShareId, action: 'viewed' });
    expect(error).not.toBeNull();
  });

  it("B cannot read A's share access log", async () => {
    const { data, error } = await b.client.from('share_access_log').select().eq('share_id', aShareId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('a client cannot read usage_counters', async () => {
    const { error } = await a.client.from('usage_counters').select();
    expect(error).not.toBeNull();
  });

  // documents and storage
  it("B cannot download A's document", async () => {
    const own = await a.client.storage.from('documents').download(aPath);
    expect(own.error).toBeNull();
    const { error } = await b.client.storage.from('documents').download(aPath);
    expect(error).not.toBeNull();
  });

  it("B cannot upload into A's folder", async () => {
    const { error } = await b.client.storage
      .from('documents')
      .upload(`${a.userId}/${randomUUID()}.jpg`, new Blob([JPEG_BYTES], { type: 'image/jpeg' }), {
        contentType: 'image/jpeg',
      });
    expect(error).not.toBeNull();
  });

  it("B removing A's object leaves it in place", async () => {
    // Storage reports success with an empty list when a removal is denied, so check the object.
    await b.client.storage.from('documents').remove([aPath]);
    const still = await a.client.storage.from('documents').download(aPath);
    expect(still.error).toBeNull();
  });

  it("B moving A's object leaves it in place", async () => {
    await b.client.storage.from('documents').move(aPath, `${b.userId}/${randomUUID()}.jpg`);
    const still = await a.client.storage.from('documents').download(aPath);
    expect(still.error).toBeNull();
  });

  it("a document row cannot point at another user's file", async () => {
    const id = randomUUID();
    const { error } = await b.client
      .from('documents')
      .insert({ id, user_id: b.userId, storage_path: aPath, kind: 'prescription' });
    expect(error).not.toBeNull();
  });

  // functions
  it('the functions refuse a caller with no session', async () => {
    const nobody = newClient();
    expect((await nobody.rpc('seed_demo_data')).error).not.toBeNull();
    expect((await nobody.rpc('delete_my_data')).error).not.toBeNull();
  });

  it("B's delete_my_data leaves A's rows alone", async () => {
    const before = (await ownRecords(a)).length;
    expect((await b.client.rpc('delete_my_data')).error).toBeNull();
    expect((await ownRecords(a)).length).toBe(before);
  });
});

describe.skipIf(!configured)('demo seed', () => {
  let c: Visitor;

  beforeAll(async () => {
    c = await signInVisitor();
  }, 30_000);

  afterAll(async () => {
    await cleanUp(c);
  }, 30_000);

  it('seed gives at least 14 records over 7 types', async () => {
    await seed(c);
    const records = await ownRecords(c);
    expect(records.length).toBeGreaterThanOrEqual(14);
    expect(new Set(records.map((r) => r.type))).toEqual(new Set(RECORD_TYPES));
    expect(new Set(records.map((r) => r.trust_level))).toEqual(new Set(TRUST_LEVELS));
    for (const record of records) {
      expect(record.user_id).toBe(c.userId);
      expect(record.details.kind).toBe(record.type);
    }
    const profile = await c.client.from('profiles').select('display_name, blood_type, keep, gemini_reads').single();
    expect(profile.data).toMatchObject({ display_name: 'Lourdes Villareal', blood_type: 'O+', keep: false, gemini_reads: 0 });
  });

  it('seed twice leaves the same count', async () => {
    await seed(c);
    const first = (await ownRecords(c)).length;
    await seed(c);
    const second = (await ownRecords(c)).length;
    expect(second).toBe(first);
  });
});
