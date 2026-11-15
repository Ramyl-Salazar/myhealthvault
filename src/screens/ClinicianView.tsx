import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { clinician, trust } from '../copy';
import { loadClinicianShare, verifyClinicianRecord, type ClinicianShare } from '../data/clinician';
import { ageYears } from '../domain/age';
import { formatDate } from '../domain/dates';
import type { HealthRecord, RecordType } from '../domain/types';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Field } from '../ui/Field';
import { IconTile } from '../ui/IconTile';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { TrustBadge } from '../ui/TrustBadge';
import { OfflineActionReason } from '../ui/OfflineBanner';
import { useOnline } from '../ui/useOnline';

const types: RecordType[] = ['allergy', 'medication', 'diagnosis', 'lab_result', 'immunization', 'procedure', 'visit'];

function detailText(record: HealthRecord): string[] {
  const details = record.details;
  switch (details.kind) {
    case 'medication': return [details.dose, details.frequency].filter((value): value is string => Boolean(value));
    case 'allergy': return [details.reaction, details.severity].filter((value): value is string => Boolean(value));
    case 'visit': return [details.reason, formatDate(details.followUpOn)].filter((value): value is string => Boolean(value));
    case 'immunization': return details.doseNumber ? [details.doseNumber] : [];
    case 'lab_result': return details.results.map(result => [result.name, result.value, result.unit].filter(Boolean).join(' '));
    default: return [];
  }
}

export function ClinicianView() {
  const online = useOnline();
  const { token = '' } = useParams();
  const [state, setState] = useState<'loading' | 'ready' | 'ended' | 'error'>('loading');
  const [data, setData] = useState<ClinicianShare | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ name: string; license: string } | null>(null);
  const [name, setName] = useState('');
  const [license, setLicense] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let current = true;
    loadClinicianShare(token).then(result => {
      if (!current) return;
      if (result.ok) { setData(result.data); setState('ready'); }
      else { setData(null); setState(result.reason === 'ended' ? 'ended' : 'error'); }
    });
    return () => { current = false; };
  }, [token, attempt]);

  useEffect(() => {
    if (!data) return;
    const timer = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= Date.parse(data.expiresAt)) { setData(null); setState('ended'); }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [data?.expiresAt]);

  async function verify(recordId: string, next: { name: string; license: string }) {
    if (!online) return;
    setPendingId(recordId);
    setVerifyError(false);
    const result = await verifyClinicianRecord(token, recordId, next.name, next.license);
    setPendingId(null);
    if (!result.ok) {
      if (result.reason === 'ended') { setData(null); setState('ended'); }
      else setVerifyError(true);
      return;
    }
    setCredentials(next);
    setSelectedId(null);
    setData(current => current ? { ...current, records: current.records.map(record => record.id === recordId ? result.record : record) } : null);
  }

  function begin(recordId: string) {
    setVerifyError(false);
    if (credentials) void verify(recordId, credentials);
    else setSelectedId(recordId);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = { name: name.trim(), license: license.trim() };
    if (next.name && next.license && selectedId) void verify(selectedId, next);
  }

  const age = ageYears(data?.patient.birthDate ?? null, new Date());
  const minutesLeft = data ? Math.max(0, Math.ceil((Date.parse(data.expiresAt) - now) / 60_000)) : 0;
  return <div className="clinician-page"><Screen title={clinician.title} nav={false} wide>
    {state === 'loading' ? <Skeleton /> : state === 'ended' ? <EmptyState message={clinician.ended} /> : state === 'error' ? <ErrorState message={clinician.loadError} onRetry={() => { setState('loading'); setAttempt(value => value + 1); }} /> : data && <div className="mx-auto grid w-full max-w-3xl gap-5">
      <section className="grid gap-3 rounded-md bg-surface p-4 shadow-card">
        <div><h2 className="text-lg font-bold wrap-anywhere">{data.patient.displayName}</h2><p className="text-sm text-ink-muted">{clinician.chosen}</p></div>
        <div className="flex flex-wrap gap-3 text-sm tabular-nums">{age !== null && <span>{clinician.years(age)}</span>}{data.patient.sex && <span className="capitalize">{data.patient.sex}</span>}{data.patient.bloodType && <span>{clinician.bloodType(data.patient.bloodType)}</span>}</div>
        <p className="text-sm text-ink-muted tabular-nums">{clinician.ends} {formatDate(data.expiresAt.slice(0, 10))} · {clinician.timeLeft(minutesLeft)}</p>
      </section>
      <section className="grid gap-2"><h2 className="text-lg font-bold">{clinician.key}</h2><div className="flex flex-wrap gap-2">{(['patient_entered', 'document_supported', 'clinician_verified'] as const).map(level => <span key={level} className="inline-flex items-center gap-2"><TrustBadge level={level} compact /><span className="text-xs">{trust[level]}</span></span>)}</div></section>
      {!data.records.length && <EmptyState message={clinician.empty} />}
      {types.map(type => {
        const group = data.records.filter(record => record.type === type);
        if (!group.length) return null;
        return <section key={type} className="grid gap-2"><h2 className="text-lg font-bold">{clinician.groups[type]}</h2><ul className="divide-y divide-line rounded-md bg-surface shadow-card">{group.map(record => <li key={record.id} className="grid gap-3 p-4"><div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:flex"><IconTile type={record.type} /><div className="min-w-0 flex-1"><h3 className="font-semibold wrap-anywhere">{record.title}</h3>{detailText(record).map((value, index) => <p key={index} className="text-sm text-ink-muted wrap-anywhere tabular-nums">{value}</p>)}{record.occurredOn && <p className="text-xs text-ink-muted tabular-nums">{formatDate(record.occurredOn)}</p>}{record.providerName && <p className="text-xs text-ink-muted wrap-anywhere">{record.providerName}</p>}</div><div className="col-start-2"><TrustBadge level={record.trustLevel} /></div></div>
          {record.details.kind === 'lab_result' && record.details.results.some(result => result.referenceRange) && <dl className="grid gap-1 text-xs text-ink-muted">{record.details.results.filter(result => result.referenceRange).map((result, index) => <div key={index}><dt className="inline">{result.name}</dt><dd className="inline"> · {clinician.referenceRange} {result.referenceRange}</dd></div>)}</dl>}
          {record.trustLevel === 'clinician_verified' ? record.verifiedBy && <p className="text-sm text-verified">{clinician.verifiedBy(record.verifiedBy)}</p> : <><Button type="button" size="sm" variant="soft" busy={pendingId === record.id} disabled={!online} onClick={() => begin(record.id)}>{clinician.verify}</Button><OfflineActionReason /></>}
          {selectedId === record.id && <form onSubmit={submit} className="grid gap-3 border-t border-line pt-3"><Field id="clinician-name" label={clinician.name} required maxLength={200} value={name} onChange={event => setName(event.target.value)} /><Field id="clinician-license" label={clinician.license} required maxLength={100} value={license} onChange={event => setLicense(event.target.value)} /><p className="text-xs text-ink-muted">{clinician.licenseNote}</p><Button type="submit" busy={pendingId === record.id} disabled={!online}>{clinician.confirm}</Button>{verifyError && <p role="alert" className="text-sm text-danger">{clinician.verifyError}</p>}</form>}
        </li>)}</ul></section>;
      })}
      {verifyError && !selectedId && <p role="alert" className="text-sm text-danger">{clinician.verifyError}</p>}
      <Button type="button" variant="quiet" onClick={() => window.print()}>{clinician.print}</Button>
    </div>}
  </Screen></div>;
}
