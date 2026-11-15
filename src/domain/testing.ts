import type { HealthRecord } from './types';

let counter = 0;

export function makeRecord(overrides: Partial<HealthRecord> = {}): HealthRecord {
  counter += 1;
  return {
    id: `rec-${counter}`,
    userId: 'user-1',
    type: 'diagnosis',
    title: 'Record',
    occurredOn: '2026-01-01',
    details: { kind: 'diagnosis' },
    providerName: null,
    notes: null,
    status: 'active',
    trustLevel: 'patient_entered',
    documentId: null,
    verifiedBy: null,
    verifiedLicense: null,
    verifiedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeMedication(
  title: string,
  med: { genericName?: string | null; endOn?: string | null } = {},
  overrides: Partial<HealthRecord> = {},
): HealthRecord {
  return makeRecord({
    type: 'medication',
    title,
    details: {
      kind: 'medication',
      genericName: med.genericName ?? null,
      dose: null,
      frequency: null,
      startOn: null,
      endOn: med.endOn ?? null,
    },
    ...overrides,
  });
}

export function makeVisit(
  title: string,
  followUpOn: string | null,
  overrides: Partial<HealthRecord> = {},
): HealthRecord {
  return makeRecord({
    type: 'visit',
    title,
    details: { kind: 'visit', reason: null, followUpOn },
    ...overrides,
  });
}
