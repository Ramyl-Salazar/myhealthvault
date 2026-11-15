// The CandidateRecord shape the function returns, and the check every Gemini reply
// passes through. Mirrors src/domain/types.ts (CandidateRecord, RecordDetails); keep
// the two in step. Anything that does not fit is dropped or set to null. Nothing is
// repaired, converted or guessed: a number where text belongs is not turned into text.

export const RECORD_TYPES = ['diagnosis', 'allergy', 'medication', 'lab_result', 'immunization', 'procedure', 'visit'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type RecordDetails =
  | { kind: 'diagnosis' }
  | { kind: 'procedure' }
  | { kind: 'allergy'; reaction: string | null; severity: 'mild' | 'moderate' | 'severe' | null }
  | { kind: 'medication'; genericName: string | null; dose: string | null; frequency: string | null; startOn: string | null; endOn: string | null }
  | { kind: 'lab_result'; results: { name: string; value: string; unit: string | null; referenceRange: string | null }[] }
  | { kind: 'immunization'; doseNumber: string | null }
  | { kind: 'visit'; reason: string | null; followUpOn: string | null };

export interface CandidateRecord {
  type: RecordType;
  title: string;
  occurredOn: string | null;
  details: RecordDetails;
  providerName: string | null;
}

/** Most candidates one page may produce. Extra ones are dropped. */
export const MAX_CANDIDATES = 20;
const MAX_TEXT = 500;
const MAX_PROVIDER = 300;
const SEVERITIES = ['mild', 'moderate', 'severe'] as const;

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A non-empty string up to max characters, trimmed at the ends only; otherwise null. */
function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

/** A real calendar date written YYYY-MM-DD; otherwise null. */
function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
}

function details(type: RecordType, raw: unknown): RecordDetails | null {
  if (!isObject(raw) || raw.kind !== type) return null;
  switch (type) {
    case 'diagnosis':
    case 'procedure':
      return { kind: type };
    case 'allergy':
      return { kind: 'allergy', reaction: text(raw.reaction), severity: SEVERITIES.find(s => s === raw.severity) ?? null };
    case 'medication':
      return { kind: 'medication', genericName: text(raw.genericName), dose: text(raw.dose), frequency: text(raw.frequency), startOn: isoDate(raw.startOn), endOn: isoDate(raw.endOn) };
    case 'lab_result': {
      if (!Array.isArray(raw.results)) return null;
      const results = raw.results.flatMap(result => {
        if (!isObject(result)) return [];
        const name = text(result.name);
        const value = text(result.value);
        return name && value ? [{ name, value, unit: text(result.unit), referenceRange: text(result.referenceRange) }] : [];
      });
      return results.length ? { kind: 'lab_result', results } : null;
    }
    case 'immunization':
      return { kind: 'immunization', doseNumber: text(raw.doseNumber) };
    case 'visit':
      return { kind: 'visit', reason: text(raw.reason), followUpOn: isoDate(raw.followUpOn) };
  }
}

function candidate(raw: unknown): CandidateRecord | null {
  if (!isObject(raw)) return null;
  const type = RECORD_TYPES.find(t => t === raw.type);
  if (!type) return null;
  const title = text(raw.title);
  if (!title) return null;
  const parsed = details(type, raw.details);
  if (!parsed) return null;
  return { type, title, occurredOn: isoDate(raw.occurredOn), details: parsed, providerName: text(raw.providerName, MAX_PROVIDER) };
}

/** Validates a parsed Gemini reply of the form { candidates: [...] }. */
export function parseCandidates(reply: unknown): CandidateRecord[] {
  if (!isObject(reply) || !Array.isArray(reply.candidates)) return [];
  return reply.candidates.slice(0, MAX_CANDIDATES).map(candidate).filter((c): c is CandidateRecord => c !== null);
}
