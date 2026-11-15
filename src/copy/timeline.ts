import type { RecordType } from '../domain/types';

export const timeline = {
  filters: { all: 'All', medication: 'Medicines', lab_result: 'Results', visit: 'Visits', diagnosis: 'Conditions', allergy: 'Allergies', immunization: 'Immunizations', procedure: 'Procedures' } as Record<'all' | RecordType, string>,
  show: 'Show',
  undated: 'Date not recorded',
  empty: 'No records here yet. Add a record to see it on your timeline.',
  error: 'Could not load records. Check your connection and try again.',
  add: 'Add a record',
} as const;
