import { formatDate } from '../domain/dates';
import type { HealthRecord } from '../domain/types';

export const home = {
  greeting: (name: string) => `Hello, ${name}`,
  scan: 'Scan a document',
  share: 'Share with a doctor',
  emergency: 'Emergency card',
  attention: 'Needs your attention',
  attentionEmpty: 'No reminders right now.',
  summary: 'Health summary',
  conditions: 'Conditions',
  allergies: 'Allergies',
  medications: 'Medicines',
  recentLabs: 'Recent results',
  lastVisits: 'Recent visits',
  empty: {
    conditions: 'No conditions recorded yet.',
    allergies: 'No allergies recorded yet.',
    medications: 'No medicines recorded yet.',
    recentLabs: 'No lab results recorded yet.',
    lastVisits: 'No visits recorded yet.',
  },
  loadError: 'Could not load your health summary. Check your connection and try again.',
  detail: (record: HealthRecord) => {
    const details = record.details;
    switch (details.kind) {
      case 'allergy': return [details.reaction, details.severity].filter(Boolean).join(', ');
      case 'medication': return [details.dose, details.frequency].filter(Boolean).join(', ');
      case 'lab_result': return [details.results.map(result => [result.name, result.unit ? `${result.value} ${result.unit}` : ''].filter(Boolean).join(' ')).join(', '), formatDate(record.occurredOn), record.providerName].filter(Boolean).join(', ');
      case 'visit': return [formatDate(record.occurredOn), record.providerName].filter(Boolean).join(', ');
      default: return [formatDate(record.occurredOn), record.providerName].filter(Boolean).join(', ');
    }
  },
} as const;
