import { X } from 'lucide-react';
import { reminders } from '../copy';
import type { Reminder } from '../domain/types';
import { IconTile } from './IconTile';

export function ReminderCard({ reminder, text, onDismiss, busy = false }: { reminder: Reminder; text: string; onDismiss: (key: string) => void; busy?: boolean }) {
  return <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
    <IconTile type={reminder.kind === 'follow_up' ? 'visit' : 'medication'} />
    <p className="min-w-0 pt-2 text-sm font-medium wrap-anywhere">{text}</p>
    <button type="button" aria-label={reminders.dismiss} disabled={busy} onClick={() => onDismiss(reminder.key)} className="grid size-11 place-items-center text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
  </li>;
}
