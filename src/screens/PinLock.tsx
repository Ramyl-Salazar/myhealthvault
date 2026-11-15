import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { pin } from '../copy/pin';
import { emergency } from '../copy/emergency';
import { loadEmergencyCard } from '../domain/emergency';
import { hasPin, pinWaitSeconds, setPin, verifyPin } from '../domain/pin';

export function PinGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [locked, setLocked] = useState(() => hasPin());
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt !== null) { if (Date.now() - hiddenAt >= 300000 && hasPin()) setLocked(true); hiddenAt = null; }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  if (location.pathname === '/emergency' || location.pathname.startsWith('/s/')) return children;
  if (!locked || !hasPin()) return children;
  return <PinLock onUnlock={() => setLocked(false)} />;
}

export function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [wait, setWait] = useState(pinWaitSeconds);
  useEffect(() => { const timer = window.setInterval(() => setWait(pinWaitSeconds()), 250); return () => window.clearInterval(timer); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await verifyPin(value)) onUnlock();
    else { setError(pin.incorrect); setWait(pinWaitSeconds()); setValue(''); }
  };
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 bg-bg p-6 text-ink"><h1 className="text-2xl font-bold">{pin.title}</h1><p>{pin.prompt}</p>
    <form onSubmit={event => { void submit(event); }} className="flex flex-col gap-4"><label className="font-medium" htmlFor="pin-input">{pin.input}</label><input id="pin-input" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={value} onChange={event => setValue(event.target.value)} className="min-h-11 rounded-md border border-ink-muted bg-white px-3" disabled={wait > 0} />{error && <p role="alert">{error}</p>}{wait > 0 && <p role="status">{pin.wait(wait)}</p>}<button className="min-h-11 rounded-md bg-primary px-4 text-on-primary disabled:opacity-50" disabled={wait > 0 || !/^\d{4}$/.test(value)}>{pin.unlock}</button></form>
    {loadEmergencyCard() && <Link className="flex min-h-11 items-center text-primary underline" to="/emergency">{emergency.title}</Link>}
  </main>;
}

export function PinSetup({ onSaved }: { onSaved?: () => void }) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(first)) { setMessage(pin.invalid); return; }
    if (first !== second) { setMessage(pin.mismatch); return; }
    if (!await setPin(first)) { setMessage(pin.unavailable); return; }
    setFirst(''); setSecond(''); setMessage(pin.saved); onSaved?.();
  };
  return <form onSubmit={event => { void submit(event); }} className="flex flex-col gap-3"><label>{pin.setup}<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={first} onChange={event => setFirst(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-ink-muted bg-white px-3" /></label><label>{pin.confirm}<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={second} onChange={event => setSecond(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-ink-muted bg-white px-3" /></label><button className="min-h-11 rounded-md bg-primary px-4 text-on-primary">{pin.save}</button>{message && <p role="status">{message}</p>}</form>;
}
