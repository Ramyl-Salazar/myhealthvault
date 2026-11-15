import { useQuery } from '@tanstack/react-query';
import { common, home } from '../copy';
import { print } from '../copy/print';
import { getProfile } from '../data/profile';
import { listRecords } from '../data/records';
import { formatDate } from '../domain/dates';
import { buildSummary } from '../domain/summary';
import type { HealthRecord } from '../domain/types';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';

function PrintSection({ title, records }: { title: string; records: HealthRecord[] }) {
  return <section className="break-inside-avoid border-b border-ink-muted/30 py-4"><h2 className="mb-2 text-lg font-semibold">{title}</h2>{records.length ? <ul className="list-disc pl-5">{records.map(record => <li key={record.id}>{record.title}{record.occurredOn ? ` · ${formatDate(record.occurredOn)}` : ''}</li>)}</ul> : <p>{print.none}</p>}</section>;
}
export function PrintSummary() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const records = useQuery({ queryKey: ['records'], queryFn: listRecords });
  const pending = profile.isPending || records.isPending;
  const failed = profile.isError || records.isError;
  if (pending) return <main className="mx-auto max-w-3xl p-6"><Skeleton /></main>;
  if (failed) return <main className="mx-auto max-w-3xl p-6"><ErrorState onRetry={() => { void profile.refetch(); void records.refetch(); }} /></main>;
  const summary = buildSummary(records.data);
  return <main className="print-summary mx-auto min-h-dvh max-w-3xl bg-surface p-6 text-ink sm:p-10"><div className="print-controls mb-6"><button className="min-h-11 rounded-md bg-primary px-5 text-on-primary" onClick={() => window.print()}>{print.action}</button></div><header className="border-b-2 border-primary pb-4"><h1 className="text-2xl font-bold">{print.title}</h1><p>{print.patient}: {profile.data.displayName}</p><p>{print.date}: {formatDate(new Date().toISOString().slice(0, 10))}</p></header>
    <PrintSection title={home.allergies} records={summary.allergies} /><PrintSection title={home.conditions} records={summary.conditions} /><PrintSection title={home.medications} records={summary.medications} /><PrintSection title={home.recentLabs} records={summary.recentLabs} /><PrintSection title={home.lastVisits} records={summary.lastVisits} /><p className="mt-6 text-sm">{common.caution}</p>
  </main>;
}
