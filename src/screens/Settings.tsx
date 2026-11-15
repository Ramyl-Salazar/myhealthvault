import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { settings } from '../copy/settings';
import { pin } from '../copy/pin';
import { exportAll } from '../data/exportData';
import { deleteEverything } from '../data/deleteData';
import { getProfile, updateProfile } from '../data/profile';
import { resetDemo } from '../data/session';
import { clearEmergencyCard } from '../domain/emergency';
import { clearPin, hasPin } from '../domain/pin';
import type { Profile } from '../domain/types';
import { ErrorState } from '../ui/ErrorState';
import { Screen } from '../ui/Screen';
import { Skeleton } from '../ui/Skeleton';
import { PinSetup } from './PinLock';

const box = 'rounded-md bg-surface p-4 shadow-card';
const field = 'mt-1 block min-h-11 w-full rounded-md border border-line bg-bg px-3 text-ink';
const button = 'min-h-11 rounded-md bg-primary px-4 text-on-primary disabled:opacity-50';

function SettingsContent({ profile }: { profile: Profile }) {
  const [form, setForm] = useState(profile);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pinExists, setPinExists] = useState(hasPin);
  useEffect(() => setForm(profile), [profile]);
  const client = useQueryClient();
  const navigate = useNavigate();
  const run = async (operation: () => Promise<void>) => { setBusy(true); setMessage(''); try { await operation(); } catch { setMessage(settings.error); } finally { setBusy(false); } };
  const save = async () => run(async () => { const saved = await updateProfile({ displayName: form.displayName, birthDate: form.birthDate, sex: form.sex, bloodType: form.bloodType, emergencyContacts: form.emergencyContacts }); client.setQueryData(['profile'], saved); setMessage(settings.saved); });
  const toggleConsent = async (enabled: boolean) => run(async () => { if (!enabled) clearEmergencyCard(); const saved = await updateProfile({ emergencyConsent: enabled }); client.setQueryData(['profile'], saved); setForm(current => ({ ...current, emergencyConsent: enabled })); });
  const download = async () => run(async () => { const blob = await exportAll(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = settings.exportName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); });
  const reset = async () => run(async () => { await resetDemo(); await client.invalidateQueries(); setMessage(settings.resetDone); });
  const remove = async () => run(async () => { await deleteEverything(); navigate('/', { replace: true }); });
  const patchContact = (index: number, patch: Partial<Profile['emergencyContacts'][number]>) => setForm(current => ({ ...current, emergencyContacts: current.emergencyContacts.map((contact, position) => position === index ? { ...contact, ...patch } : contact) }));
  return <Screen title={settings.title}>
    <section className={box}><h2 className="mb-4 text-lg font-semibold">{settings.profile}</h2><form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-3">
      <label className="block">{settings.name}<input className={field} value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} /></label>
      <label className="block">{settings.birthDate}<input className={field} type="date" value={form.birthDate ?? ''} onChange={event => setForm(current => ({ ...current, birthDate: event.target.value || null }))} /></label>
      <label className="block">{settings.sex}<input className={field} value={form.sex ?? ''} onChange={event => setForm(current => ({ ...current, sex: event.target.value || null }))} /></label>
      <label className="block">{settings.bloodType}<input className={field} value={form.bloodType ?? ''} onChange={event => setForm(current => ({ ...current, bloodType: event.target.value || null }))} /></label>
      <h3 className="font-semibold">{settings.contacts}</h3>{form.emergencyContacts.map((contact, index) => <fieldset key={index} className="space-y-2 rounded-md border border-ink-muted p-3"><legend className="px-1">{settings.contacts} {index + 1}</legend><label className="block">{settings.contactName}<input className={field} value={contact.name} onChange={event => patchContact(index, { name: event.target.value })} /></label><label className="block">{settings.relation}<input className={field} value={contact.relation} onChange={event => patchContact(index, { relation: event.target.value })} /></label><label className="block">{settings.phone}<input className={field} type="tel" value={contact.phone} onChange={event => patchContact(index, { phone: event.target.value })} /></label><button type="button" className="min-h-11 text-danger underline" onClick={() => setForm(current => ({ ...current, emergencyContacts: current.emergencyContacts.filter((_, position) => position !== index) }))}>{settings.removeContact}</button></fieldset>)}
      {form.emergencyContacts.length < 3 && <button type="button" className="min-h-11 text-primary underline" onClick={() => setForm(current => ({ ...current, emergencyContacts: [...current.emergencyContacts, { name: '', relation: '', phone: '' }] }))}>{settings.addContact}</button>}
      <button className={button} disabled={busy}>{settings.save}</button></form></section>
    <section className={box}><h2 className="text-lg font-semibold">{settings.emergency}</h2><label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" checked={form.emergencyConsent} onChange={event => { void toggleConsent(event.target.checked); }} />{settings.emergencyToggle}</label><p className="text-sm text-ink-muted">{pin.consent}</p></section>
    <section className={box}><h2 className="mb-3 text-lg font-semibold">{settings.pin}</h2><PinSetup onSaved={() => setPinExists(true)} />{pinExists && <button className="mt-3 min-h-11 text-danger underline" onClick={() => { clearPin(); setPinExists(false); }}>{pin.remove}</button>}</section>
    <section className={`${box} flex flex-col gap-3`}><h2 className="text-lg font-semibold">{settings.data}</h2><button className={button} disabled={busy} onClick={() => { void download(); }}>{settings.download}</button><Link className="flex min-h-11 items-center text-primary underline" to="/print">{settings.print}</Link><button className="min-h-11 text-left text-primary underline" disabled={busy} onClick={() => { void reset(); }}>{settings.reset}</button><p className="text-sm text-ink-muted">{settings.brandNote}</p></section>
    <section className={box}><h2 className="text-lg font-semibold">{settings.delete}</h2><p className="my-3 text-sm text-ink-muted">{settings.deleteNote}</p><label className="block">{settings.deletePrompt}<input className={field} value={confirm} onChange={event => setConfirm(event.target.value)} /></label><button className="mt-3 min-h-11 rounded-md bg-danger px-4 text-bg disabled:opacity-50" disabled={busy || confirm !== settings.deleteWord} onClick={() => { void remove(); }}>{settings.delete}</button></section>
    {message && <p role="status">{message}</p>}
  </Screen>;
}

export function Settings() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  if (profile.isPending) return <Screen title={settings.title}><Skeleton /></Screen>;
  if (profile.isError) return <Screen title={settings.title}><ErrorState onRetry={() => { void profile.refetch(); }} /></Screen>;
  return <SettingsContent profile={profile.data} />;
}
