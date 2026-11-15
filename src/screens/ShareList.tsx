import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { screens, share } from '../copy';
import { getShareLog, listShares } from '../data/shares';
import { formatDate } from '../domain/dates';
import { shareState, type Share } from '../domain/share';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';

function ShareRow({ item }: { item: Share }) {
  const log = useQuery({ queryKey: ['share-log', item.id], queryFn: () => getShareLog(item.id) });
  const state = shareState(item, new Date());
  const views = log.data?.filter(entry => entry.action === 'viewed').length;
  return <li className="border-b border-line last:border-b-0"><Link to={`/share/${item.id}`} className="flex min-h-12 items-center justify-between gap-4 p-4 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span className="min-w-0"><span className="block font-semibold wrap-anywhere">{item.label || share.defaultName}</span><span className="text-xs text-ink-muted tabular-nums">{formatDate(item.createdAt.slice(0, 10))}{views !== undefined && ` · ${share.opened(views)}`}</span></span><span className={`shrink-0 text-sm ${state === 'ended' ? 'text-ink-muted' : 'text-primary'}`}>{state === 'ended' ? share.ended : share.active}</span></Link></li>;
}

export function ShareList() {
  const query = useQuery({ queryKey: ['shares'], queryFn: listShares });
  const sorted = [...(query.data ?? [])].sort((a, b) => Number(shareState(b, new Date()) === 'active') - Number(shareState(a, new Date()) === 'active'));
  return <Screen title={screens.share}>
    <Link to="/share/new" className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-4 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{share.new}</Link>
    {query.isPending ? <Skeleton /> : query.isError ? <ErrorState message={share.loadError} onRetry={() => void query.refetch()} /> : !sorted.length ? <EmptyState message={share.empty} /> : <ul className="rounded-md bg-surface shadow-card">{sorted.map(item => <ShareRow key={item.id} item={item} />)}</ul>}
  </Screen>;
}
