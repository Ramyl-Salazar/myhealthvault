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
    JSON.stringify(before.details) === JSON.stringify(after.details);
  return unchanged ? before.trustLevel : 'patient_entered';
}
