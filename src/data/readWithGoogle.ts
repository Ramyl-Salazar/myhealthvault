import type { CandidateRecord } from '../domain/types';
import { supabase } from './supabase';

export type GoogleReadResult = { ok: true; candidates: CandidateRecord[] } | { ok: false; reason: 'limit' | 'unavailable' };

/**
 * Asks the read-document Edge Function to read an uploaded page with Google AI.
 * The signed-in user's session token is sent by supabase.functions.invoke.
 * 429 means a read limit was reached; any other failure is 'unavailable'.
 * Contract: docs/contracts/read-document.md.
 */
export async function readWithGoogle(documentId: string): Promise<GoogleReadResult> {
  try {
    const { data, error } = await supabase.functions.invoke('read-document', { method: 'POST', body: { documentId } });
    if (error) {
      // A FunctionsHttpError carries the function's Response as its context.
      const context: unknown = (error as { context?: unknown }).context;
      return { ok: false, reason: context instanceof Response && context.status === 429 ? 'limit' : 'unavailable' };
    }
    const candidates = (data as { candidates?: unknown } | null)?.candidates;
    if (!Array.isArray(candidates)) return { ok: false, reason: 'unavailable' };
    return { ok: true, candidates: candidates as CandidateRecord[] };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
