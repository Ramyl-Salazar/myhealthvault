import { beforeEach, expect, it, vi } from 'vitest';
import type { Reminder } from '../domain/types';
import { syncNotifications } from './notifications';

const { schedule, cancel, native } = vi.hoisted(() => ({ schedule: vi.fn(async (_input: { notifications: { schedule: { at: Date } }[] }) => ({})), cancel: vi.fn(async (_input: unknown) => ({})), native: vi.fn(() => false) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: native } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { schedule, cancel, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }) } }));
const reminders: Reminder[] = [
  { key: 'follow:1', kind: 'follow_up', dueOn: '2026-12-01', recordIds: ['1'] },
  { key: 'ending:2', kind: 'prescription_ending', dueOn: '2026-12-02', recordIds: ['2'] },
  { key: 'duplicate:3', kind: 'possible_duplicate', dueOn: null, recordIds: ['3'] },
];
beforeEach(() => { localStorage.clear(); schedule.mockClear(); cancel.mockClear(); native.mockReturnValue(false); });
it('does nothing in the browser', async () => { await syncNotifications(reminders); expect(schedule).not.toHaveBeenCalled(); });
it('schedules one notification for each dated reminder on a phone', async () => {
  native.mockReturnValue(true);
  await syncNotifications(reminders);
  expect(schedule.mock.calls[0][0].notifications).toHaveLength(2);
  expect(schedule.mock.calls[0][0].notifications[0].schedule.at.getHours()).toBe(9);
});
