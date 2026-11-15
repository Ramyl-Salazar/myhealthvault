import { Capacitor } from '@capacitor/core';
import type { Reminder } from '../domain/types';
import { notifications } from '../copy/notifications';
import { safeStorage } from '../domain/storage';

let scheduledIds: number[] = [];
const storageKey = 'mhv.notificationIds.v1';
function idFor(key: string): number {
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 1) || 1;
}
export async function syncNotifications(reminders: Reminder[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted' && (await LocalNotifications.requestPermissions()).display !== 'granted') return;
  const previous = safeStorage.get(storageKey);
  if (previous) { try { scheduledIds = JSON.parse(previous) as number[]; } catch { /* stale cache */ } }
  if (scheduledIds.length) await LocalNotifications.cancel({ notifications: scheduledIds.map(id => ({ id })) });
  const now = Date.now();
  const dated = reminders.filter(reminder => reminder.dueOn).map(reminder => {
    const [year, month, day] = reminder.dueOn!.split('-').map(Number);
    const at = new Date(year, month - 1, day, 9);
    return { reminder, at };
  }).filter(item => item.at.getTime() > now);
  const items = dated.map(({ reminder, at }) => ({ id: idFor(reminder.key), title: notifications.title, body: reminder.kind === 'follow_up' ? notifications.followUp : reminder.kind === 'prescription_ending' ? notifications.ending : notifications.duplicate, schedule: { at } }));
  scheduledIds = items.map(item => item.id);
  if (items.length) await LocalNotifications.schedule({ notifications: items });
  safeStorage.set(storageKey, JSON.stringify(scheduledIds));
}
