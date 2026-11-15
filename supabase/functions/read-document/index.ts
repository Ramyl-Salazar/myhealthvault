// Edge Function entry (Deno). Wires the handler to Supabase and Gemini; the logic and
// its tests are in handler.ts and index.test.ts. Contract: docs/contracts/read-document.md.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.ts';
import { requestGemini } from './prompt.ts';

/** Default model: a stable Flash-Lite model on Google's free tier (checked 16 Nov 2026). */
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
/** Default app-wide reads per UTC day, kept well below the free tier's daily request limit. */
const DEFAULT_DAILY_CAP = 100;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// The service role is needed to write gemini_reads and usage_counters, which no client
// may write. Every query below is scoped to the caller or to the counter row by hand.
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

function rows(result: { data: unknown; error: { message: string } | null }): unknown {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const handler = createHandler({
  apiKey: Deno.env.get('GEMINI_API_KEY') || undefined,
  model: Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL,
  dailyCap: positiveInt(Deno.env.get('GEMINI_DAILY_CAP'), DEFAULT_DAILY_CAP),
  today: () => new Date().toISOString().slice(0, 10),

  async userId(authorization) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },

  async findDocument(userId, documentId) {
    const data = rows(await admin.from('documents').select('storage_path').eq('id', documentId).eq('user_id', userId).maybeSingle()) as { storage_path: string } | null;
    return data ? { storagePath: data.storage_path } : null;
  },

  async downloadImage(storagePath) {
    const { data, error } = await admin.storage.from('documents').download(storagePath);
    return error ? null : data;
  },

  counters: {
    async userReads(userId) {
      const data = rows(await admin.from('profiles').select('gemini_reads').eq('id', userId).maybeSingle()) as { gemini_reads: number } | null;
      return data ? data.gemini_reads : null;
    },
    async swapUserReads(userId, from, to) {
      const data = rows(await admin.from('profiles').update({ gemini_reads: to }).eq('id', userId).eq('gemini_reads', from).select('id')) as unknown[];
      return data.length === 1;
    },
    async dayReads(day) {
      rows(await admin.from('usage_counters').upsert({ day, gemini_reads: 0 }, { onConflict: 'day', ignoreDuplicates: true }));
      const data = rows(await admin.from('usage_counters').select('gemini_reads').eq('day', day).single()) as { gemini_reads: number };
      return data.gemini_reads;
    },
    async swapDayReads(day, from, to) {
      const data = rows(await admin.from('usage_counters').update({ gemini_reads: to }).eq('day', day).eq('gemini_reads', from).select('day')) as unknown[];
      return data.length === 1;
    },
  },

  readImage: input => requestGemini(fetch, input),
});

Deno.serve(handler);
