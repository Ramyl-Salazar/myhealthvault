import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { screens, timeline } from '../copy';
import { listRecords } from '../data/records';
import { parseIsoDate } from '../domain/dates';
import type { HealthRecord, RecordType } from '../domain/types';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { RecordRow } from '../ui/RecordRow';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';

type Filter = 'all' | RecordType;
const filters: Filter[] = ['all', 'medication', 'lab_result', 'visit', 'diagnosis', 'allergy', 'immunization', 'procedure'];

function newestFirst(a: HealthRecord, b: HealthRecord) {
  if (!a.occurredOn) return b.occurredOn ? 1 : 0;
  if (!b.occurredOn) return -1;
  return b.occurredOn.localeCompare(a.occurredOn);
}

export function Timeline() {
  const [filter, setFilter] = useState<Filter>('all');
  const query = useQuery({ queryKey: ['records'], queryFn: listRecords });
  const shown = (query.data ?? []).filter(record => filter === 'all' || record.type === filter).sort(newestFirst);
  const grouped = new Map<string, HealthRecord[]>();
  shown.forEach(record => {
    const year = parseIsoDate(record.occurredOn)?.year.toString() ?? timeline.undated;
    grouped.set(year, [...(grouped.get(year) ?? []), record]);
  });

  return <Screen title={screens.timeline}>
    <div role="group" aria-label={timeline.show} className="-mr-4 flex gap-2 overflow-x-auto pb-2 pr-4">
      {filters.map(type => <button key={type} type="button" onClick={() => setFilter(type)} aria-pressed={filter === type} className={`min-h-11 shrink-0 rounded-pill px-4 text-sm font-medium shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${filter === type ? 'bg-primary text-on-primary' : 'bg-surface text-ink'}`}>{timeline.filters[type]}</button>)}
    </div>
    {query.isPending ? <Skeleton /> : query.isError ? <ErrorState message={timeline.error} onRetry={() => void query.refetch()} /> : shown.length === 0 ? <div className="flex flex-col items-start gap-3"><EmptyState message={timeline.empty} /><Link to="/add" className="inline-flex min-h-11 items-center rounded-pill bg-primary px-4 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{timeline.add}</Link></div> :
      [...grouped].map(([year, records]) => <section key={year} className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-muted tabular-nums">{year}</h2>
        <ol className="rounded-md bg-surface shadow-card">{records.map(record => <RecordRow key={record.id} record={record} />)}</ol>
      </section>)}
  </Screen>;
}
