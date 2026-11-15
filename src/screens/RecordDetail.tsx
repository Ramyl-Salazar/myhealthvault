import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { records, screens } from '../copy';
import { documentUrl } from '../data/documents';
import { deleteRecord, getRecord } from '../data/records';
import { formatDate } from '../domain/dates';
import type { HealthRecord, RecordDetails } from '../domain/types';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { IconTile } from '../ui/IconTile';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { TrustBadge } from '../ui/TrustBadge';
import { OfflineActionReason } from '../ui/OfflineBanner';
import { useOnline } from '../ui/useOnline';

function Value({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div className="border-t border-line py-3 first:border-t-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 wrap-anywhere tabular-nums">{value}</dd></div>;
}

function Details({ details }: { details: RecordDetails }) {
  switch (details.kind) {
    case 'allergy': return <><Value label={records.reaction} value={details.reaction} /><Value label={records.severity} value={details.severity} /></>;
    case 'medication': return <><Value label={records.genericName} value={details.genericName} /><Value label={records.dose} value={details.dose} /><Value label={records.frequency} value={details.frequency} /><Value label={records.startOn} value={formatDate(details.startOn)} /><Value label={records.endOn} value={formatDate(details.endOn)} /></>;
    case 'lab_result': return details.results.map((result, index) => <div key={index} className="border-t border-line first:border-t-0"><Value label={records.resultName} value={result.name} /><Value label={records.resultValue} value={[result.value, result.unit].filter(Boolean).join(' ')} /><Value label={records.referenceRange} value={result.referenceRange} /></div>);
    case 'immunization': return <Value label={records.doseNumber} value={details.doseNumber} />;
    case 'visit': return <><Value label={records.reason} value={details.reason} /><Value label={records.followUpOn} value={formatDate(details.followUpOn)} /></>;
    default: return null;
  }
}

function LinkedDocument({ record }: { record: HealthRecord }) {
  const [failed, setFailed] = useState(false);
  const path = record.documentId ? `${record.userId}/${record.documentId}.jpg` : null;
  const query = useQuery({ queryKey: ['document', path], queryFn: () => documentUrl(path as string), enabled: Boolean(path) });
  if (!path) return null;
  return <section className="flex flex-col gap-3">
    <h2 className="font-semibold">{records.document}</h2>
    {query.isPending ? <Skeleton /> : query.isError || failed ? <ErrorState message={records.documentError} onRetry={() => { setFailed(false); void query.refetch(); }} /> :
      <img src={query.data} alt={records.document} onError={() => setFailed(true)} className="w-full rounded-sm bg-surface object-contain shadow-card" />}
  </section>;
}

export function RecordDetail() {
  const online = useOnline();
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['record', id], queryFn: () => getRecord(id as string), enabled: Boolean(id), refetchOnMount: 'always', refetchInterval: online ? 5000 : false });
  const deletion = useMutation({ mutationFn: () => deleteRecord(id as string), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['records'] }); navigate('/timeline', { replace: true }); } });

  function remove() {
    if (!online) return;
    if (window.confirm(records.confirmDelete)) deletion.mutate();
  }

  const record = query.data;
  return <Screen title={screens.record}>
    {query.isPending ? <Skeleton /> : query.isError ? <ErrorState message={records.error} onRetry={() => void query.refetch()} /> : !record ? <EmptyState message={records.missing} /> : <>
      <section className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3"><IconTile type={record.type} /><div className="min-w-0"><h2 className="text-lg font-semibold wrap-anywhere">{record.title}</h2><TrustBadge level={record.trustLevel} /></div></div>
        <dl><Value label={records.date} value={formatDate(record.occurredOn)} /><Value label={records.provider} value={record.providerName} /><Details details={record.details} /><Value label={records.notes} value={record.notes} /><Value label={records.status} value={records[record.status]} />
          {record.trustLevel === 'clinician_verified' && <><Value label={records.verifiedBy} value={record.verifiedBy} /><Value label={records.verifiedOn} value={formatDate(record.verifiedAt?.slice(0, 10) ?? null)} /></>}
        </dl>
      </section>
      <LinkedDocument record={record} />
      {deletion.isError && <ErrorState message={records.deleteError} onRetry={remove} />}
      <div className="flex gap-2"><Link to={`/records/${record.id}/edit`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-pill bg-primary-soft px-4 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{records.edit}</Link><Button type="button" variant="quiet" size="sm" busy={deletion.isPending} disabled={!online} onClick={remove} className="flex-1 text-danger">{records.delete}</Button></div>
      <OfflineActionReason />
    </>}
  </Screen>;
}
