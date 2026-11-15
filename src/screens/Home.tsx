import { useEffect, useState } from 'react';
import { Camera, QrCode, ShieldAlert } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { common, home, reminders, screens } from '../copy';
import { getProfile } from '../data/profile';
import { listRecords } from '../data/records';
import { syncNotifications } from '../data/notifications';
import { dismissReminder, listDismissed } from '../data/reminders';
import { formatDate } from '../domain/dates';
import { computeReminders } from '../domain/reminders';
import { buildSummary } from '../domain/summary';
import type { HealthRecord, Reminder } from '../domain/types';
import { ErrorState } from '../ui/ErrorState';
import { ReminderCard } from '../ui/ReminderCard';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { SummarySection } from '../ui/SummarySection';
import { useOnline } from '../ui/useOnline';

function reminderText(reminder: Reminder, byId: Map<string, HealthRecord>): string {
  const first = byId.get(reminder.recordIds[0]);
  if (reminder.kind === 'possible_duplicate') return reminders.duplicate(reminder.recordIds.map(id => byId.get(id)?.title).filter(Boolean).join(', '), reminder.key.slice(4));
  const date = formatDate(reminder.dueOn);
  if (reminder.kind === 'follow_up') return reminders.followUp(date, first?.providerName ?? null);
  return reminders.ending(first?.title ?? '', date);
}

function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function Home() {
  const online = useOnline();
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date();
      setToday(localDate(now));
      clearTimeout(timer);
      timer = setTimeout(update, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime());
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') update(); };
    update();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  const [locallyDismissed, setLocallyDismissed] = useState<Set<string>>(new Set());
  const client = useQueryClient();
  const recordsQuery = useQuery({ queryKey: ['records'], queryFn: listRecords });
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const dismissedQuery = useQuery({ queryKey: ['dismissed'], queryFn: listDismissed });
  const dismissal = useMutation({ mutationFn: (key: string) => dismissReminder(key), onSuccess: async (_, key) => {
    setLocallyDismissed(current => new Set([...current, key]));
    await Promise.all([client.invalidateQueries({ queryKey: ['dismissed'] }), client.invalidateQueries({ queryKey: ['records'] })]);
  } });

  const pending = recordsQuery.isPending || profileQuery.isPending || dismissedQuery.isPending;
  const failed = recordsQuery.isError || profileQuery.isError || dismissedQuery.isError;
  const name = profileQuery.data?.displayName.trim().split(/\s+/)[0] ?? '';
  const initials = profileQuery.data?.displayName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() ?? '';
  const allRecords = recordsQuery.data ?? [];
  const byId = new Map(allRecords.map(record => [record.id, record]));
  const summary = buildSummary(allRecords);
  const dismissed = new Set([...(dismissedQuery.data ?? new Set<string>()), ...locallyDismissed]);
  const visibleReminders = computeReminders(allRecords, today, dismissed);
  useEffect(() => { if (!pending && !failed) void syncNotifications(visibleReminders).catch(() => undefined); }, [pending, failed, visibleReminders.map(reminder => reminder.key).join('|')]);

  return <Screen title={pending || failed ? screens.home : home.greeting(name)} headerLeading={!pending && !failed ? <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-on-primary">{initials}</span> : undefined} subtitle={!pending && !failed ? formatDate(today) : undefined}>
    {pending ? <Skeleton /> : failed ? <ErrorState message={home.loadError} onRetry={() => { void recordsQuery.refetch(); void profileQuery.refetch(); void dismissedQuery.refetch(); }} /> : <>
      <div className="grid grid-cols-3 gap-2">
        <Link to="/scan" className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md bg-surface p-2 text-center text-xs font-medium leading-tight text-ink shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary"><Camera size={20} strokeWidth={1.9} aria-hidden="true" /></span>{home.scan}</Link>
        <Link to="/share/new" className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md bg-surface p-2 text-center text-xs font-medium leading-tight text-ink shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span className="grid size-10 place-items-center rounded-md bg-cat-visit-soft text-cat-visit"><QrCode size={20} strokeWidth={1.9} aria-hidden="true" /></span>{home.share}</Link>
        <Link to="/emergency" className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md bg-surface p-2 text-center text-xs font-medium leading-tight text-ink shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span className="grid size-10 place-items-center rounded-md bg-cat-allergy-soft text-cat-allergy"><ShieldAlert size={20} strokeWidth={1.9} aria-hidden="true" /></span>{home.emergency}</Link>
      </div>
      <section className="flex flex-col gap-3"><h2 className="font-semibold">{home.attention}</h2>
        {visibleReminders.length === 0 ? <p className="text-sm text-ink-muted">{home.attentionEmpty}</p> : <><ul className="rounded-md bg-surface shadow-card">{visibleReminders.map(reminder => <ReminderCard key={reminder.key} reminder={reminder} text={reminderText(reminder, byId)} onDismiss={key => dismissal.mutate(key)} busy={dismissal.isPending || !online} />)}</ul><p className="text-xs text-ink-muted">{common.caution}</p></>}
        {dismissal.isError && <ErrorState message={reminders.error} onRetry={() => dismissal.mutate(dismissal.variables as string)} />}
      </section>
      <section className="flex flex-col gap-3"><h2 className="font-semibold">{home.summary}</h2>
        <SummarySection kind="allergies" records={summary.allergies} />
        <SummarySection kind="conditions" records={summary.conditions} />
        <SummarySection kind="medications" records={summary.medications} />
        <SummarySection kind="recentLabs" records={summary.recentLabs} />
        <SummarySection kind="lastVisits" records={summary.lastVisits} />
      </section>
    </>}
  </Screen>;
}
