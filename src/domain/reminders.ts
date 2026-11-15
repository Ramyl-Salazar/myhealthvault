import { dayNumber } from './dates';
import { toGeneric } from './generics';
import type { HealthRecord, Reminder } from './types';

const FOLLOW_UP_WINDOW_DAYS = 30;
const PRESCRIPTION_WINDOW_DAYS = 7;

export function computeReminders(records: HealthRecord[], today: string, dismissed: Set<string>): Reminder[] {
  const todayNumber = dayNumber(today);
  if (todayNumber === null) return [];

  const found: Reminder[] = [];

  for (const record of records) {
    const { details } = record;

    if (record.type === 'visit' && details.kind === 'visit' && details.followUpOn) {
      const due = dayNumber(details.followUpOn);
      if (due !== null && Math.abs(due - todayNumber) <= FOLLOW_UP_WINDOW_DAYS) {
        found.push({ key: `follow_up:${record.id}`, kind: 'follow_up', recordIds: [record.id], dueOn: details.followUpOn });
      }
    }

    if (record.type === 'medication' && record.status === 'active' && details.kind === 'medication' && details.endOn) {
      const due = dayNumber(details.endOn);
      if (due !== null && due >= todayNumber && due - todayNumber <= PRESCRIPTION_WINDOW_DAYS) {
        found.push({ key: `rx_end:${record.id}`, kind: 'prescription_ending', recordIds: [record.id], dueOn: details.endOn });
      }
    }
  }

  const byGeneric = new Map<string, string[]>();
  for (const record of records) {
    if (record.type !== 'medication' || record.status !== 'active') continue;
    const given = record.details.kind === 'medication' ? record.details.genericName : null;
    const generic = toGeneric(given && given.trim() !== '' ? given : record.title);
    if (generic === '') continue;
    byGeneric.set(generic, [...(byGeneric.get(generic) ?? []), record.id]);
  }
  for (const [generic, ids] of byGeneric) {
    if (ids.length >= 2) {
      found.push({ key: `dup:${generic}`, kind: 'possible_duplicate', recordIds: ids, dueOn: null });
    }
  }

  return found.filter((r) => !dismissed.has(r.key)).sort(compareReminders);
}

function compareReminders(a: Reminder, b: Reminder): number {
  const aDup = a.kind === 'possible_duplicate';
  const bDup = b.kind === 'possible_duplicate';
  if (aDup !== bDup) return aDup ? -1 : 1;
  if (a.dueOn === b.dueOn) return 0;
  if (a.dueOn === null) return 1;
  if (b.dueOn === null) return -1;
  return a.dueOn < b.dueOn ? -1 : 1;
}
