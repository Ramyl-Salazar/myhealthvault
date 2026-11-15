import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { common, entry } from '../copy';
import { startDemo } from '../data/session';
import { Button } from '../ui/Button';
import { DemoMarker } from '../ui/DemoMarker';
import { ErrorState } from '../ui/ErrorState';

export function DemoEntry() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function begin() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await startDemo();
      navigate('/home', { replace: true });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="app-column mx-auto flex min-h-dvh w-full flex-col bg-bg px-4 text-ink">
    <header className="flex justify-end pt-4"><DemoMarker /></header>
    <main className="flex flex-1 flex-col justify-center gap-5 pb-8">
      <h1 className="text-2xl leading-tight font-bold">{common.appName}</h1>
      <p className="text-base text-ink-muted">{entry.note}</p>
      {failed ? <ErrorState message={entry.error} onRetry={begin} /> : <Button busy={busy} onClick={begin}>{entry.button}</Button>}
    </main>
  </div>;
}
