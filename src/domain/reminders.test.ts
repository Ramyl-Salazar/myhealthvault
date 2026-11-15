import { describe, expect, it } from 'vitest';
import { computeReminders } from './reminders';
import { makeMedication, makeRecord, makeVisit } from './testing';

const today = '2026-11-15';

const metformin = makeMedication('Metformin', { genericName: 'Metformin' }, { id: 'metformin' });
const glucophage = makeMedication('Glucophage 500 mg', { genericName: null }, { id: 'glucophage' });
const resolvedMetformin = makeMedication('Metformin', { genericName: 'Metformin' }, { id: 'resolved', status: 'resolved' });
const endsIn7 = makeMedication('Amlodipine', { endOn: '2026-11-22' }, { id: 'ends7' });
const endsIn8 = makeMedication('Losartan', { endOn: '2026-11-23' }, { id: 'ends8' });
const medWithNullEverything = makeRecord({
  type: 'medication',
  title: '',
  occurredOn: null,
  details: { kind: 'medication', genericName: null, dose: null, frequency: null, startOn: null, endOn: null },
});
const visitWithNoFollowUp = makeVisit('Check-up', null, { occurredOn: null });

const keys = (rs: ReturnType<typeof computeReminders>) => rs.map((r) => r.key);

describe('possible_duplicate', () => {
  it('flags two active medications sharing a generic', () => {
    const rs = computeReminders([metformin, glucophage], today, new Set());
    expect(keys(rs)).toContain('dup:metformin');
    expect(rs[0].kind).toBe('possible_duplicate');
    expect(rs[0].dueOn).toBeNull();
  });
  it('ignores resolved medications', () => {
    expect(computeReminders([resolvedMetformin, glucophage], today, new Set())).toHaveLength(0);
  });
  it('gives one reminder with three recordIds for three medications on one generic', () => {
    const third = makeMedication('Metformin XR 500 mg', {}, { id: 'third' });
    const rs = computeReminders([metformin, glucophage, third], today, new Set());
    expect(rs).toHaveLength(1);
    expect(rs[0].recordIds).toEqual(['metformin', 'glucophage', 'third']);
  });
  it('falls back to the title when genericName is empty or whitespace', () => {
    const blank = makeMedication('Glucophage 500 mg', { genericName: '' }, { id: 'blank' });
    const spaces = makeMedication('Glucophage 500 mg', { genericName: '   ' }, { id: 'spaces' });
    const rs = computeReminders([blank, metformin], today, new Set());
    expect(keys(rs)).toEqual(['dup:metformin']);
    expect(rs[0].recordIds).toEqual(['blank', 'metformin']);
    expect(keys(computeReminders([spaces, metformin], today, new Set()))).toEqual(['dup:metformin']);
  });
  it('does not flag a single medication', () => {
    expect(computeReminders([metformin], today, new Set())).toHaveLength(0);
  });
  it('honours dismissal', () => {
    expect(computeReminders([metformin, glucophage], today, new Set(['dup:metformin']))).toHaveLength(0);
  });
});

describe('prescription_ending', () => {
  it('includes endOn at today + 7 and excludes today + 8', () => {
    expect(computeReminders([endsIn7], today, new Set())).toHaveLength(1);
    expect(computeReminders([endsIn8], today, new Set())).toHaveLength(0);
  });
  it('includes endOn equal to today and excludes yesterday', () => {
    const endsToday = makeMedication('X', { endOn: today });
    const ended = makeMedication('Y', { endOn: '2026-11-14' });
    const rs = computeReminders([endsToday, ended], today, new Set());
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ kind: 'prescription_ending', dueOn: today, key: `rx_end:${endsToday.id}` });
  });
  it('crosses a month and year boundary', () => {
    expect(computeReminders([makeMedication('X', { endOn: '2027-01-03' })], '2026-12-27', new Set())).toHaveLength(1);
    expect(computeReminders([makeMedication('X', { endOn: '2027-01-04' })], '2026-12-27', new Set())).toHaveLength(0);
  });
  it('ignores a resolved medication', () => {
    expect(computeReminders([makeMedication('X', { endOn: today }, { status: 'resolved' })], today, new Set())).toHaveLength(0);
  });
});

describe('follow_up', () => {
  it('includes follow-ups 30 days before and after today', () => {
    const before = makeVisit('b', '2026-10-16');
    const after = makeVisit('a', '2026-12-15');
    const rs = computeReminders([before, after], today, new Set());
    expect(keys(rs)).toEqual([`follow_up:${before.id}`, `follow_up:${after.id}`]);
  });
  it('excludes follow-ups 31 days before and after today', () => {
    expect(computeReminders([makeVisit('b', '2026-10-15')], today, new Set())).toHaveLength(0);
    expect(computeReminders([makeVisit('a', '2026-12-16')], today, new Set())).toHaveLength(0);
  });
  it('sets dueOn and recordIds', () => {
    const v = makeVisit('v', '2026-11-20');
    expect(computeReminders([v], today, new Set())[0]).toEqual({
      key: `follow_up:${v.id}`,
      kind: 'follow_up',
      recordIds: [v.id],
      dueOn: '2026-11-20',
    });
  });
});

describe('ordering and missing fields', () => {
  it('puts duplicates first, then dueOn ascending', () => {
    const late = makeVisit('late', '2026-12-01');
    const early = makeVisit('early', '2026-11-20');
    const rs = computeReminders([late, early, metformin, glucophage], today, new Set());
    expect(rs.map((r) => r.kind)).toEqual(['possible_duplicate', 'follow_up', 'follow_up']);
    expect(rs[1].recordIds).toEqual([early.id]);
  });
  it('does not throw on missing fields', () => {
    expect(() => computeReminders([medWithNullEverything, visitWithNoFollowUp], today, new Set())).not.toThrow();
    expect(computeReminders([medWithNullEverything, visitWithNoFollowUp], today, new Set())).toHaveLength(0);
  });
  it('does not throw on malformed date strings', () => {
    const bad = makeMedication('X', { endOn: 'soon' });
    expect(computeReminders([bad, makeVisit('v', 'later')], today, new Set())).toHaveLength(0);
  });
});
