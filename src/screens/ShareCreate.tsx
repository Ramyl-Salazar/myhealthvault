import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { form, screens, share } from '../copy';
import { listRecords } from '../data/records';
import { createShare, type NewShareInput } from '../data/shares';
import { DURATIONS, type ShareMinutes } from '../domain/share';
import type { RecordType } from '../domain/types';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Field } from '../ui/Field';
import { IconTile } from '../ui/IconTile';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { OfflineActionReason } from '../ui/OfflineBanner';
import { useOnline } from '../ui/useOnline';

const types: RecordType[] = ['diagnosis', 'allergy', 'medication', 'lab_result', 'immunization', 'procedure', 'visit'];
type Scope = 'everything' | 'category' | 'individual';

export function ShareCreate() {
  const online = useOnline();
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['records'], queryFn: listRecords });
  const [scope, setScope] = useState<Scope>('everything');
  const [type, setType] = useState<RecordType>('medication');
  const [ids, setIds] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<ShareMinutes>(60);
  const [name, setName] = useState('');
  const [selectionError, setSelectionError] = useState(false);
  const records = query.data ?? [];
  const recordIds = scope === 'everything' ? records.filter(record => record.status === 'active').map(record => record.id) : scope === 'category' ? records.filter(record => record.type === type).map(record => record.id) : ids;
  const mutation = useMutation({ mutationFn: (input: NewShareInput) => createShare(input), onSuccess: async result => {
    try { sessionStorage.setItem(`share-url:${result.id}`, result.url); } catch { /* Router state still carries the link. */ }
    await client.invalidateQueries({ queryKey: ['shares'] });
    navigate(`/share/${result.id}`, { state: { url: result.url } });
  } });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return;
    if (!recordIds.length) { setSelectionError(true); return; }
    setSelectionError(false);
    mutation.mutate({ label: name.trim() || share.defaultName, recordIds, minutes });
  }

  return <Screen title={screens.shareNew}>
    {query.isPending ? <Skeleton /> : query.isError ? <ErrorState message={share.recordsError} onRetry={() => void query.refetch()} /> : <form onSubmit={submit} className="grid gap-5">
      <Field id="share-name" label={share.name} value={name} maxLength={200} onChange={event => setName(event.target.value)} />
      <fieldset className="grid gap-2"><legend className="mb-2 font-semibold">{share.scope}</legend>
        {(['everything', 'category', 'individual'] as Scope[]).map(choice => <label key={choice} className="flex min-h-11 items-center gap-3 rounded-sm bg-surface px-4 py-2"><input type="radio" name="scope" checked={scope === choice} onChange={() => { setScope(choice); setSelectionError(false); }} />{share[choice]}</label>)}
      </fieldset>
      {scope === 'category' && <label className="grid gap-1 text-sm text-ink-muted">{share.categoryLabel}<select className="min-h-12 rounded-sm border border-line bg-surface px-3 text-ink" value={type} onChange={event => setType(event.target.value as RecordType)}>{types.map(choice => <option key={choice} value={choice}>{form.types[choice]}</option>)}</select></label>}
      {scope === 'individual' && (records.length ? <ul className="divide-y divide-line rounded-md bg-surface shadow-card">{records.map(record => <li key={record.id}><label className="flex min-h-12 items-center gap-3 p-4"><input type="checkbox" checked={ids.includes(record.id)} onChange={event => setIds(current => event.target.checked ? [...current, record.id] : current.filter(id => id !== record.id))} /><IconTile type={record.type} size="sm" /><span className="min-w-0 wrap-anywhere">{record.title}</span></label></li>)}</ul> : <EmptyState />)}
      {scope === 'everything' && records.length > 0 && <ul className="divide-y divide-line rounded-md bg-surface shadow-card">{records.filter(record => record.status === 'active').map(record => <li key={record.id} className="flex min-h-11 items-center gap-3 p-4"><IconTile type={record.type} size="sm" /><span className="wrap-anywhere">{record.title}</span></li>)}</ul>}
      {selectionError && <p role="alert" className="text-sm text-danger">{share.chooseRecords}</p>}
      <label className="grid gap-1 text-sm text-ink-muted">{share.duration}<select className="min-h-12 rounded-sm border border-line bg-surface px-3 text-ink" value={minutes} onChange={event => setMinutes(Number(event.target.value) as ShareMinutes)}>{DURATIONS.map(value => <option key={value} value={value}>{share.durations[value]}</option>)}</select></label>
      {mutation.isError && <p role="alert" className="text-sm text-danger">{share.createError}</p>}
      <Button type="submit" busy={mutation.isPending} disabled={!online}>{share.create}</Button>
      <OfflineActionReason />
    </form>}
  </Screen>;
}
