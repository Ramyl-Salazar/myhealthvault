import { describe, expect, it } from 'vitest';
import { buildSummary } from './summary';
import { makeMedication, makeRecord, makeVisit } from './testing';

const lab = (title: string, occurredOn: string | null) =>
  makeRecord({
    type: 'lab_result',
    title,
    occurredOn,
    details: { kind: 'lab_result', results: [] },
  });

const allergy = (id: string, status: 'active' | 'resolved') =>
  makeRecord({ id, type: 'allergy', status, details: { kind: 'allergy', reaction: null, severity: null } });

describe('buildSummary', () => {
  it('keeps only active conditions, allergies and medications', () => {
    const s = buildSummary([
      makeRecord({ id: 'd1', type: 'diagnosis' }),
      makeRecord({ id: 'd2', type: 'diagnosis', status: 'resolved' }),
      allergy('a1', 'active'),
      allergy('a2', 'resolved'),
      makeMedication('Metformin', {}, { id: 'm1' }),
      makeMedication('Old', {}, { id: 'm2', status: 'resolved' }),
    ]);
    expect(s.conditions.map((r) => r.id)).toEqual(['d1']);
    expect(s.allergies.map((r) => r.id)).toEqual(['a1']);
    expect(s.medications.map((r) => r.id)).toEqual(['m1']);
  });

  it('returns the 3 newest labs, newest first', () => {
    const s = buildSummary([
      lab('a', '2026-01-01'),
      lab('b', '2026-04-01'),
      lab('c', '2026-03-01'),
      lab('d', '2026-02-01'),
    ]);
    expect(s.recentLabs.map((r) => r.title)).toEqual(['b', 'c', 'd']);
  });

  it('returns the 3 newest visits', () => {
    const s = buildSummary([
      makeVisit('v1', null, { occurredOn: '2026-01-01' }),
      makeVisit('v2', null, { occurredOn: '2026-05-01' }),
      makeVisit('v3', null, { occurredOn: '2026-03-01' }),
      makeVisit('v4', null, { occurredOn: '2025-12-01' }),
    ]);
    expect(s.lastVisits.map((r) => r.title)).toEqual(['v2', 'v3', 'v1']);
  });

  it('puts records with no date last', () => {
    const s = buildSummary([
      makeVisit('undated', null, { occurredOn: null }),
      makeVisit('dated', null, { occurredOn: '2026-01-01' }),
    ]);
    expect(s.lastVisits.map((r) => r.title)).toEqual(['dated', 'undated']);
  });

  it('includes a record with no date', () => {
    const recordWithNullDate = makeRecord({ type: 'diagnosis', occurredOn: null });
    expect(buildSummary([recordWithNullDate]).conditions).toHaveLength(1);
  });

  it('returns empty lists for no records', () => {
    expect(buildSummary([])).toEqual({ conditions: [], allergies: [], medications: [], recentLabs: [], lastVisits: [] });
  });

  it('does not change the input order', () => {
    const input = [lab('a', '2026-01-01'), lab('b', '2026-02-01')];
    buildSummary(input);
    expect(input.map((r) => r.title)).toEqual(['a', 'b']);
  });
});
