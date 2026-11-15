import type { CandidateRecord } from '../domain/types';

export type GoogleReadResult = { ok: true; candidates: CandidateRecord[] } | { ok: false; reason: 'limit' | 'unavailable' };

export async function readWithGoogle(_documentId: string): Promise<GoogleReadResult> {
  return { ok: false, reason: 'unavailable' };
}
