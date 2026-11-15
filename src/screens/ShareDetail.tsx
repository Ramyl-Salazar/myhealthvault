import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router-dom';
import { screens, share } from '../copy';
import { getShareLog, listShares, revokeShare } from '../data/shares';
import { formatDate } from '../domain/dates';
import { shareState } from '../domain/share';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { OfflineActionReason } from '../ui/OfflineBanner';
import { useOnline } from '../ui/useOnline';

function shownDate(iso: string): string {
  return `${formatDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}

export function ShareDetail() {
  const online = useOnline();
  const { id = '' } = useParams();
  const location = useLocation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['shares'], queryFn: listShares });
  const log = useQuery({ queryKey: ['share-log', id], queryFn: () => getShareLog(id), enabled: Boolean(id), refetchInterval: online ? 5000 : false });
  const item = query.data?.find(entry => entry.id === id);
  const active = item && shareState(item, new Date()) === 'active';
  const [url] = useState(() => {
    const fromRoute = (location.state as { url?: string } | null)?.url;
    if (fromRoute) return fromRoute;
    try { return sessionStorage.getItem(`share-url:${id}`) ?? ''; } catch { return ''; }
  });
  const [qr, setQr] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    if (!active || !url) return;
    let current = true;
    import('qrcode').then(module => module.toString(url, { type: 'svg', margin: 4 })).then(svg => { if (current) setQr(`data:image/svg+xml,${encodeURIComponent(svg)}`); }).catch(() => { if (current) setQr(''); });
    return () => { current = false; };
  }, [active, url]);
  const mutation = useMutation({ mutationFn: () => revokeShare(id), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['shares'] }); } });

  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setCopyMessage(share.copied); }
    catch { setCopyMessage(share.copyError); }
  }

  return <Screen title={screens.shareDetail}>
    {query.isPending ? <Skeleton /> : query.isError ? <ErrorState message={share.loadError} onRetry={() => void query.refetch()} /> : !item ? <EmptyState /> : <>
      <section className="grid gap-4 rounded-md bg-surface p-4 shadow-card"><h2 className="text-lg font-bold wrap-anywhere">{item.label || share.defaultName}</h2>
        <p className="text-sm text-ink-muted">{active ? share.active : share.ended}</p>
        <p className="text-sm text-ink-muted tabular-nums">{share.expires} {shownDate(item.expiresAt)}</p>
        {active && <p className="text-sm tabular-nums">{share.timeLeft(Math.ceil((Date.parse(item.expiresAt) - Date.now()) / 60_000))}</p>}
        {active && url ? <div className="grid gap-3">{qr && <img src={qr} alt={share.qrLabel} className="w-52 max-w-full bg-white p-2" />}<label className="grid gap-1 text-sm text-ink-muted">{share.link}<input readOnly value={url} className="min-h-12 w-full rounded-sm border border-line bg-bg px-3 text-ink wrap-anywhere" /></label><Button type="button" variant="soft" onClick={() => void copyLink()}>{share.copy}</Button>{copyMessage && <p role="status" className="text-sm">{copyMessage}</p>}</div> : active ? <p className="text-sm text-ink-muted">{share.unavailableLink}</p> : null}
        {active && <><Button type="button" variant="quiet" busy={mutation.isPending} disabled={!online} onClick={() => mutation.mutate()}>{share.stop}</Button><OfflineActionReason /></>}
        {mutation.isError && <p role="alert" className="text-sm text-danger">{share.stopError}</p>}
      </section>
      <section className="grid gap-3"><h2 className="text-lg font-bold">{share.log}</h2>{log.isPending ? <Skeleton /> : log.isError ? <ErrorState message={share.loadError} onRetry={() => void log.refetch()} /> : !log.data?.length ? <p className="text-sm text-ink-muted">{share.noLog}</p> : <ul className="divide-y divide-line rounded-md bg-surface shadow-card">{log.data.map(entry => <li key={entry.id} className="flex items-center justify-between gap-3 p-4 text-sm"><span>{entry.action === 'viewed' ? share.viewed : share.verified}</span><time className="shrink-0 text-ink-muted tabular-nums" dateTime={entry.createdAt}>{shownDate(entry.createdAt)}</time></li>)}</ul>}</section>
    </>}
  </Screen>;
}
