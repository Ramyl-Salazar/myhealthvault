import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { form } from '../copy';
import { createRecord, updateRecord } from '../data/records';
import { trustAfterEdit } from '../domain/trust';
import type { CandidateRecord, HealthRecord, RecordDetails, RecordStatus, RecordType } from '../domain/types';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { IconTile } from '../ui/IconTile';
import { OfflineActionReason } from '../ui/OfflineBanner';
import { useOnline } from '../ui/useOnline';

const types: RecordType[] = ['diagnosis', 'allergy', 'medication', 'lab_result', 'immunization', 'procedure', 'visit'];
type Values = Record<string, string>;

function initialValues(initial?: CandidateRecord | HealthRecord): Values {
  const details = initial?.details;
  const result = details?.kind === 'lab_result' ? details.results[0] : undefined;
  return {
    title: initial?.title ?? '', occurredOn: initial?.occurredOn ?? '', providerName: initial?.providerName ?? '',
    notes: initial && 'notes' in initial ? initial.notes ?? '' : '',
    genericName: details?.kind === 'medication' ? details.genericName ?? '' : '',
    dose: details?.kind === 'medication' ? details.dose ?? '' : '',
    frequency: details?.kind === 'medication' ? details.frequency ?? '' : '',
    startOn: details?.kind === 'medication' ? details.startOn ?? '' : '',
    endOn: details?.kind === 'medication' ? details.endOn ?? '' : '',
    reaction: details?.kind === 'allergy' ? details.reaction ?? '' : '',
    severity: details?.kind === 'allergy' ? details.severity ?? '' : '',
    resultName: result?.name ?? '', resultValue: result?.value ?? '', resultUnit: result?.unit ?? '', referenceRange: result?.referenceRange ?? '',
    doseNumber: details?.kind === 'immunization' ? details.doseNumber ?? '' : '',
    reason: details?.kind === 'visit' ? details.reason ?? '' : '',
    followUpOn: details?.kind === 'visit' ? details.followUpOn ?? '' : '',
  };
}

function detailsFor(type: RecordType, values: Values, extraResults: Values[]): RecordDetails {
  const nullable = (key: string) => values[key]?.trim() || null;
  switch (type) {
    case 'allergy': return { kind: type, reaction: nullable('reaction'), severity: (nullable('severity') as 'mild' | 'moderate' | 'severe' | null) };
    case 'medication': return { kind: type, genericName: nullable('genericName'), dose: nullable('dose'), frequency: nullable('frequency'), startOn: nullable('startOn'), endOn: nullable('endOn') };
    case 'lab_result': return { kind: type, results: [values, ...extraResults].filter(row => row.resultName || row.resultValue).map(row => ({ name: row.resultName.trim(), value: row.resultValue.trim(), unit: row.resultUnit?.trim() || null, referenceRange: row.referenceRange?.trim() || null })) };
    case 'immunization': return { kind: type, doseNumber: nullable('doseNumber') };
    case 'visit': return { kind: type, reason: nullable('reason'), followUpOn: nullable('followUpOn') };
    case 'procedure': return { kind: type };
    case 'diagnosis': return { kind: type };
  }
}

export function RecordForm({ initial, onSaved, source = 'manual', resolveDocumentId }: { initial?: CandidateRecord | HealthRecord; onSaved: (record: HealthRecord) => void; source?: 'manual' | 'scan'; resolveDocumentId?: () => Promise<string> }) {
  const online = useOnline();
  const clientId = useRef(crypto.randomUUID());
  const before = initial && 'id' in initial ? initial : null;
  const [type, setType] = useState<RecordType>(initial?.type ?? 'diagnosis');
  const [values, setValues] = useState<Values>(() => initialValues(initial));
  const [extraResults, setExtraResults] = useState<Values[]>(() => initial?.details.kind === 'lab_result' ? initial.details.results.slice(1).map(result => ({ resultName: result.name, resultValue: result.value, resultUnit: result.unit ?? '', referenceRange: result.referenceRange ?? '' })) : []);
  const [status, setStatus] = useState<RecordStatus>(before?.status ?? 'active');
  const [titleError, setTitleError] = useState(false);
  const client = useQueryClient();

  const details = detailsFor(type, values, extraResults);
  const candidate: CandidateRecord = { type, title: values.title.trim(), occurredOn: values.occurredOn || null, providerName: values.providerName.trim() || null, details };
  const willRemoveVerification = before?.trustLevel === 'clinician_verified' && trustAfterEdit(before, { title: candidate.title, occurredOn: candidate.occurredOn, details, status }) === 'patient_entered';
  const mutation = useMutation({
    mutationFn: async () => before ? updateRecord(before, { title: candidate.title, occurredOn: candidate.occurredOn, providerName: candidate.providerName, details, notes: values.notes.trim() || null, status }) : createRecord({ ...candidate, notes: values.notes.trim() || null, status, source, documentId: resolveDocumentId ? await resolveDocumentId() : null, clientId: clientId.current }),
    onSuccess: async record => { await client.invalidateQueries({ queryKey: ['records'] }); onSaved(record); },
  });

  function set(key: string, value: string) { setValues(current => ({ ...current, [key]: value })); }
  function field(key: string, label: string, inputType = 'text') { return <Field key={key} id={`${clientId.current}-${key}`} label={label} type={inputType} value={values[key] ?? ''} onChange={event => set(key, event.target.value)} />; }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return;
    if (!candidate.title) { setTitleError(true); return; }
    setTitleError(false);
    mutation.mutate();
  }

  return <form onSubmit={submit} className="flex flex-col gap-4">
    {!before && <fieldset className="flex flex-col gap-2"><legend className="mb-2 text-sm text-ink-muted">{form.type}</legend><div className="grid grid-cols-2 gap-2">
      {types.map(choice => <button key={choice} type="button" aria-pressed={type === choice} onClick={() => setType(choice)} className={`flex min-h-12 items-center gap-2 rounded-sm border p-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${type === choice ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-ink'}`}><IconTile type={choice} size="sm" />{form.types[choice]}</button>)}
    </div></fieldset>}
    {field('title', form.title)}
    {titleError && <p role="alert" className="text-sm text-danger">{form.titleRequired}</p>}
    {field('occurredOn', form.date, 'date')}
    {field('providerName', form.provider)}
    {type === 'allergy' && <>{field('reaction', form.reaction)}<label className="flex flex-col gap-1 text-sm text-ink-muted">{form.severity}<select value={values.severity} onChange={event => set('severity', event.target.value)} className="min-h-12 rounded-sm border border-line bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><option value=""></option><option value="mild">{form.mild}</option><option value="moderate">{form.moderate}</option><option value="severe">{form.severe}</option></select></label></>}
    {type === 'medication' && <>{field('genericName', form.genericName)}{field('dose', form.dose)}{field('frequency', form.frequency)}{field('startOn', form.startOn, 'date')}{field('endOn', form.endOn, 'date')}</>}
    {type === 'lab_result' && <>{field('resultName', form.resultName)}{field('resultValue', form.resultValue)}{field('resultUnit', form.resultUnit)}{field('referenceRange', form.referenceRange)}</>}
    {type === 'lab_result' && extraResults.map((result, index) => <div key={index} className="flex flex-col gap-3 border-t border-line pt-3">
      {(['resultName', 'resultValue', 'resultUnit', 'referenceRange'] as const).map(key => <Field key={key} id={`${clientId.current}-${key}-${index}`} label={form[key]} value={result[key] ?? ''} onChange={event => setExtraResults(rows => rows.map((row, at) => at === index ? { ...row, [key]: event.target.value } : row))} />)}
      <Button type="button" variant="quiet" size="sm" onClick={() => setExtraResults(rows => rows.filter((_, at) => at !== index))}>{form.removeResult}</Button>
    </div>)}
    {type === 'lab_result' && <Button type="button" variant="soft" size="sm" onClick={() => setExtraResults(rows => [...rows, { resultName: '', resultValue: '', resultUnit: '', referenceRange: '' }])}>{form.addResult}</Button>}
    {type === 'immunization' && field('doseNumber', form.doseNumber)}
    {type === 'visit' && <>{field('reason', form.reason)}{field('followUpOn', form.followUpOn, 'date')}</>}
    <label className="flex flex-col gap-1 text-sm text-ink-muted">{form.status}<select value={status} onChange={event => setStatus(event.target.value as RecordStatus)} className="min-h-12 rounded-sm border border-line bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><option value="active">{form.active}</option><option value="resolved">{form.resolved}</option></select></label>
    {field('notes', form.notes)}
    {willRemoveVerification && <p className="rounded-sm bg-patient-soft p-3 text-sm text-patient">{form.verificationWarning}</p>}
    {mutation.isError && <p role="alert" className="text-sm text-danger">{form.saveError}</p>}
    <Button type="submit" busy={mutation.isPending} disabled={!online}>{form.save}</Button>
    <OfflineActionReason />
  </form>;
}
