import type { HealthRecord, TrustLevel } from './types';

export function trustForNew(source: 'manual' | 'scan'): TrustLevel {
  return source === 'scan' ? 'document_supported' : 'patient_entered';
}

/**
 * Changing the title, date, details or status of a record removes whatever
 * trust it had. Changing only the provider or notes keeps it.
 */
export function trustAfterEdit(
  before: HealthRecord,
  after: Pick<HealthRecord, 'title' | 'occurredOn' | 'details' | 'status'>,
): TrustLevel {
  const unchanged =
    before.title === after.title &&
    before.occurredOn === after.occurredOn &&
    before.status === after.status &&
    sameValue(before.details, after.details);
  return unchanged ? before.trustLevel : 'patient_entered';
}

// Deep equality that ignores object key order (jsonb returns its own order),
// treats undefined and a missing key as null, and compares arrays in order.
function sameValue(a: unknown, b: unknown): boolean {
  const x = a === undefined ? null : a;
  const y = b === undefined ? null : b;
  if (Array.isArray(x) || Array.isArray(y)) {
    return Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((item, i) => sameValue(item, y[i]));
  }
  if (typeof x === 'object' && typeof y === 'object' && x !== null && y !== null) {
    const xo = x as Record<string, unknown>;
    const yo = y as Record<string, unknown>;
    const keys = new Set([...Object.keys(xo), ...Object.keys(yo)]);
    return [...keys].every((key) => sameValue(xo[key], yo[key]));
  }
  return x === y;
}
