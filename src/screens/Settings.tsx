import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { settings } from '../copy/settings';
import { sexOptions } from '../copy/sex';
import { pin } from '../copy/pin';
import { exportAll } from '../data/exportData';
import { deleteEverything } from '../data/deleteData';
import { getProfile, updateProfile } from '../data/profile';
import { resetDemo } from '../data/session';
import { clearEmergencyCard } from '../domain/emergency';
import { clearPin, hasPin } from '../domain/pin';
import { parseIsoDate } from '../domain/dates';
import type { Profile } from '../domain/types';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { PinSetup } from './PinLock';
import { OfflineActionReason } from '../ui/OfflineBanner';
import { useOnline } from '../ui/useOnline';

const box = 'rounded-md bg-surface p-4 shadow-card';
const field = 'mt-1 block min-h-11 w-full rounded-md border border-line bg-bg px-3 text-ink';

function dateFields(iso: string | null) {
  const parts = parseIsoDate(iso);
  return { day: parts ? String(parts.day) : '', month: parts ? String(parts.month) : '', year: parts ? String(parts.year) : '' };
}

function SettingsContent({ profile }: { profile: Profile }) {
  const online = useOnline();
  const [form, setForm] = useState(profile);
  const [birth, setBirth] = useState(() => dateFields(profile.birthDate));
  const [birthError, setBirthError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pinExists, setPinExists] = useState(hasPin);
  const client = useQueryClient();
  const navigate = useNavigate();
  const run = async (operation: () => Promise<void>) => { if (!online) return; setBusy(true); setMessage(''); try { await operation(); } catch { setMessage(settings.error); } finally { setBusy(false); } };
  const save = async () => {
    const empty = !birth.day && !birth.month && !birth.year;
    const candidate = `${birth.year.padStart(4, '0')}-${birth.month.padStart(2, '0')}-${birth.day.padStart(2, '0')}`;
    if (!empty && !parseIsoDate(candidate)) { setBirthError(settings.invalidBirthDate); return; }
    setBirthError('');
    await run(async () => { const saved = await updateProfile({ displayName: form.displayName, birthDate: empty ? null : candidate, sex: form.sex, bloodType: form.bloodType, emergencyContacts: form.emergencyContacts }); client.setQueryData(['profile'], saved); setMessage(settings.saved); });
  };
  const toggleConsent = async (enabled: boolean) => run(async () => { const saved = await updateProfile({ emergencyConsent: enabled }); if (!enabled) clearEmergencyCard(); client.setQueryData(['profile'], saved); setForm(current => ({ ...current, emergencyConsent: enabled })); });
  const download = async () => run(async () => { const blob = await exportAll(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = settings.exportName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); });
  const reset = async () => run(async () => { await resetDemo(); setResetConfirm(false); await client.invalidateQueries(); setMessage(settings.resetDone); });
  const remove = async () => run(async () => { await deleteEverything(); navigate('/', { replace: true }); });
  const patchContact = (index: number, patch: Partial<Profile['emergencyContacts'][number]>) => setForm(current => ({ ...current, emergencyContacts: current.emergencyContacts.map((contact, position) => position === index ? { ...contact, ...patch } : contact) }));
  return <Screen title={settings.title}>
    <section className={box}><h2 className="mb-4 text-lg font-semibold">{settings.profile}</h2><form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-3">
      <label className="block">{settings.name}<input className={field} value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} /></label>
      <fieldset><legend className="mb-1">{settings.birthDate}</legend><div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
        <label>{settings.day}<input className={field} inputMode="numeric" value={birth.day} onChange={event => { setBirth(current => ({ ...current, day: event.target.value })); setBirthError(''); }} /></label>
        <label>{settings.month}<select className={field} value={birth.month} onChange={event => { setBirth(current => ({ ...current, month: event.target.value })); setBirthError(''); }}><option value="">{settings.month}</option>{settings.months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
        <label>{settings.year}<input className={field} inputMode="numeric" value={birth.year} onChange={event => { setBirth(current => ({ ...current, year: event.target.value })); setBirthError(''); }} /></label>
      </div>{birthError && <p role="alert" className="mt-2 text-sm text-danger">{birthError}</p>}</fieldset>
      <label className="block">{settings.sex}<select className={field} value={form.sex ?? ''} onChange={event => setForm(current => ({ ...current, sex: event.target.value || null }))}><option value="">{settings.sexNone}</option>{sexOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}{form.sex && !sexOptions.some(option => option.value === form.sex) && <option value={form.sex}>{form.sex}</option>}</select></label>
      <label className="block">{settings.bloodType}<input className={field} value={form.bloodType ?? ''} onChange={event => setForm(current => ({ ...current, bloodType: event.target.value || null }))} /></label>
      <h3 className="pt-2 font-semibold">{settings.contacts}</h3>{form.emergencyContacts.map((contact, index) => <fieldset key={index} className="space-y-2 rounded-md border border-line p-3"><legend className="px-1">{settings.contact(index + 1)}</legend><label className="block">{settings.contactName}<input className={field} value={contact.name} onChange={event => patchContact(index, { name: event.target.value })} /></label><label className="block">{settings.relation}<input className={field} value={contact.relation} onChange={event => patchContact(index, { relation: event.target.value })} /></label><label className="block">{settings.phone}<input className={field} type="tel" value={contact.phone} onChange={event => patchContact(index, { phone: event.target.value })} /></label><Button type="button" variant="quiet" className="w-full" onClick={() => setForm(current => ({ ...current, emergencyContacts: current.emergencyContacts.filter((_, position) => position !== index) }))}>{settings.removeContact}</Button></fieldset>)}
      <div className="flex flex-col gap-3 pt-2">{form.emergencyContacts.length < 3 && <Button type="button" variant="quiet" className="w-full" onClick={() => setForm(current => ({ ...current, emergencyContacts: [...current.emergencyContacts, { name: '', relation: '', phone: '' }] }))}>{settings.addContact}</Button>}
        <Button type="submit" className="w-full" busy={busy} disabled={!online}>{settings.save}</Button><OfflineActionReason /></div></form></section>
    <section className={box}><h2 className="text-lg font-semibold">{settings.emergency}</h2><label className="mt-3 flex min-h-11 items-center justify-between gap-3"><span>{settings.emergencyToggle}</span><span className="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center"><input type="checkbox" className="peer sr-only" checked={form.emergencyConsent} disabled={!online} onChange={event => { void toggleConsent(event.target.checked); }} /><span aria-hidden="true" className={`flex h-7 w-11 items-center rounded-pill p-1 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${form.emergencyConsent ? 'bg-primary' : 'bg-line'}`}><span className={`size-5 rounded-full bg-surface transition-transform ${form.emergencyConsent ? 'translate-x-4' : ''}`} /></span></span></label><p className="text-sm text-ink-muted">{pin.consent}</p><OfflineActionReason /></section>
    <section className={box}><h2 className="mb-3 text-lg font-semibold">{settings.pin}</h2><PinSetup onSaved={() => setPinExists(true)} />{pinExists && <Button variant="quiet" className="mt-3 w-full" onClick={() => { clearPin(); setPinExists(false); }}>{pin.remove}</Button>}</section>
    <section className={`${box} flex flex-col gap-3`}><h2 className="text-lg font-semibold">{settings.data}</h2><Button className="w-full" busy={busy} onClick={() => { void download(); }}>{settings.download}</Button><Link className="flex min-h-12 items-center justify-center rounded-pill bg-primary-soft px-4 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" to="/print">{settings.print}</Link><Button variant="quiet" className="w-full" busy={busy} disabled={!online} onClick={() => setResetConfirm(true)}>{settings.reset}</Button>{resetConfirm && <div className="rounded-md border border-line p-3"><p className="mb-3">{settings.resetConfirm}</p><div className="grid grid-cols-2 gap-3"><Button variant="soft" busy={busy} disabled={!online} onClick={() => { void reset(); }}>{settings.resetAction}</Button><Button variant="quiet" onClick={() => setResetConfirm(false)}>{settings.cancel}</Button></div></div>}<OfflineActionReason /><p className="text-sm text-ink-muted">{settings.brandNote}</p></section>
    <section className={box}><h2 className="text-lg font-semibold">{settings.delete}</h2><p className="my-3 text-sm text-ink-muted">{settings.deleteNote}</p><label className="block">{settings.deletePrompt}<input className={field} value={confirm} onChange={event => setConfirm(event.target.value)} /></label><Button className="mt-3 w-full !bg-danger !text-bg" busy={busy} disabled={!online || confirm.trim().toLowerCase() !== settings.deleteWord} onClick={() => { void remove(); }}>{settings.delete}</Button><OfflineActionReason /></section>
    {message && <p role="status">{message}</p>}
  </Screen>;
}

export function Settings() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  if (profile.isPending) return <Screen title={settings.title}><Skeleton /></Screen>;
  if (profile.isError) return <Screen title={settings.title}><ErrorState onRetry={() => { void profile.refetch(); }} /></Screen>;
  return <SettingsContent profile={profile.data} />;
}
