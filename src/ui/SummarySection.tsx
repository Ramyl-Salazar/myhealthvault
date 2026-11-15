import { Link } from 'react-router-dom';
import { home } from '../copy';
import type { HealthRecord, Summary } from '../domain/types';
import { IconTile } from './IconTile';
import { TrustBadge } from './TrustBadge';

type Kind = keyof Summary;
const tileType = { conditions: 'diagnosis', allergies: 'allergy', medications: 'medication', recentLabs: 'lab_result', lastVisits: 'visit' } as const;

export function SummarySection({ kind, records }: { kind: Kind; records: HealthRecord[] }) {
  return <section aria-label={home[kind]} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
    <div className="flex items-center gap-3"><IconTile type={tileType[kind]} /><h3 className="font-semibold">{home[kind]}</h3><span className="ml-auto text-xs text-ink-muted tabular-nums">{records.length}</span></div>
    {records.length === 0 ? <p className="pl-13 text-sm text-ink-muted">{home.empty[kind]}</p> :
      <ul className="flex flex-col gap-3 pl-13">{records.map(record => <li key={record.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <Link to={`/records/${record.id}`} className={`min-h-11 wrap-anywhere text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${kind === 'allergies' ? 'font-semibold text-danger' : ''}`}>{record.title}<span className="block text-sm font-normal text-ink-muted tabular-nums">{home.detail(record)}</span></Link>
        <TrustBadge level={record.trustLevel} compact />
      </li>)}</ul>}
  </section>;
}
