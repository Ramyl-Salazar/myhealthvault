import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { form, screens } from '../copy';
import { getRecord } from '../data/records';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { RecordForm } from './RecordForm';

export function AddRecord() {
  const [manual, setManual] = useState(false);
  const navigate = useNavigate();
  return <Screen title={screens.add}>
    <div className="flex flex-col gap-2">
      <Link to="/scan" className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-soft px-4 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{form.scan}</Link>
      {!manual && <Button type="button" onClick={() => setManual(true)}>{form.manual}</Button>}
    </div>
    {manual && <RecordForm onSaved={record => navigate(`/records/${record.id}`)} />}
  </Screen>;
}

export function EditRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['record', id], queryFn: () => getRecord(id as string), enabled: Boolean(id), refetchOnMount: 'always' });
  return <Screen title={screens.edit}>
    {query.isError ? <ErrorState message={form.loadError} onRetry={() => void query.refetch()} /> : query.isPending || query.isFetching ? <Skeleton /> : !query.data ? <EmptyState /> :
      <RecordForm key={query.data.updatedAt} initial={query.data} onSaved={record => navigate(`/records/${record.id}`)} />}
  </Screen>;
}
