import type { HealthRecord, RecordType, Summary } from './types';

const NEWEST_COUNT = 3;

function newestFirst(a: HealthRecord, b: HealthRecord): number {
  if (a.occurredOn === b.occurredOn) return 0;
  if (a.occurredOn === null) return 1;
  if (b.occurredOn === null) return -1;
  return a.occurredOn < b.occurredOn ? 1 : -1;
}

function ofType(records: HealthRecord[], type: RecordType): HealthRecord[] {
  return records.filter((r) => r.type === type);
}

export function buildSummary(records: HealthRecord[]): Summary {
  const active = records.filter((r) => r.status === 'active');
  return {
    conditions: ofType(active, 'diagnosis'),
    allergies: ofType(active, 'allergy'),
    medications: ofType(active, 'medication'),
    recentLabs: ofType(records, 'lab_result').sort(newestFirst).slice(0, NEWEST_COUNT),
    lastVisits: ofType(records, 'visit').sort(newestFirst).slice(0, NEWEST_COUNT),
  };
}
