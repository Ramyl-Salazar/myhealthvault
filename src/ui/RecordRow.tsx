import { Link } from 'react-router-dom';
import type { HealthRecord } from '../domain/types';
import { formatDate } from '../domain/dates';
import { IconTile } from './IconTile';
import { TrustBadge } from './TrustBadge';

export function RecordRow({ record }: { record: HealthRecord }) {
  const date = formatDate(record.occurredOn);
  const meta = [date, record.providerName].filter(Boolean).join(', ');
  return <li className="border-b border-line last:border-b-0">
    <Link to={`/records/${record.id}`} className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-4 text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <IconTile type={record.type} />
      <span className="min-w-0">
        <span className="block font-semibold wrap-anywhere">{record.title}</span>
        {meta && <span className="mt-2 block text-xs text-ink-muted tabular-nums wrap-anywhere">{meta}</span>}
      </span>
      <TrustBadge level={record.trustLevel} compact />
    </Link>
  </li>;
}
