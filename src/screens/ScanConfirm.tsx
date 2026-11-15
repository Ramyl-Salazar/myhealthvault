import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { scan, screens } from '../copy';
import { readWithGoogle } from '../data/readWithGoogle';
import { uploadDocument } from '../data/documents';
import { prepareImage } from '../domain/extract/image';
import type { CandidateRecord } from '../domain/types';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { RecordForm } from './RecordForm';

export interface ScanState {
  image?: Blob;
  imagePath?: string;
  sampleId?: string;
  candidates: CandidateRecord[];
  help: boolean;
}

export function ScanConfirm() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ScanState | null;
  const [remaining, setRemaining] = useState<number[]>(() => state?.candidates.map((_, index) => index) ?? []);
  const [manual, setManual] = useState(false);
  const [googleMessage, setGoogleMessage] = useState(false);
  const [imageUrl, setImageUrl] = useState(state?.imagePath ?? '');
  const documentPromise = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (!state?.image || typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(state.image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [state?.image]);

  if (!state) return <Navigate to="/scan" replace />;

  async function resolveDocumentId(): Promise<string> {
    if (!documentPromise.current) {
      documentPromise.current = (async () => {
        const raw = state?.image ?? await (async () => {
          const response = await fetch(state?.imagePath ?? '');
          if (!response.ok) throw new Error('Could not load the sample page');
          return response.blob();
        })();
        const image = state?.image ? raw : await prepareImage(raw);
        const uploaded = await uploadDocument(image, state?.sampleId ?? 'scan');
        return uploaded.id;
      })().catch(error => { documentPromise.current = null; throw error; });
    }
    return documentPromise.current;
  }

  function remove(index: number) {
    setRemaining(current => current.filter(value => value !== index));
    if (remaining.length === 1) navigate('/timeline');
  }

  async function google() {
    try {
      const result = await readWithGoogle('');
      if (result.ok) { setRemaining([]); setManual(false); return; }
    } catch { /* Show the same manual fallback. */ }
    setGoogleMessage(true);
    setManual(true);
  }

  return <Screen title={screens.scanConfirm} wide>
    <p className="text-sm text-ink-muted">{scan.review}</p>
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        {imageUrl && <img src={imageUrl} alt={scan.page} className="h-auto w-full" />}
      </div>
      <div className="grid gap-4">
        {googleMessage && <p role="status" className="rounded-sm bg-primary-soft p-4 text-sm text-primary">{scan.googleUnavailable}</p>}
        {state.help && !manual && <section className="grid gap-3 rounded-sm border border-line bg-surface p-4"><p>{scan.readError}</p><Button type="button" onClick={() => void google()}>{scan.google}</Button><Button type="button" variant="soft" onClick={() => setManual(true)}>{scan.manual}</Button></section>}
        {manual && <div className="rounded-sm border border-line bg-surface p-4"><RecordForm source="scan" resolveDocumentId={resolveDocumentId} onSaved={() => navigate('/timeline')} /></div>}
        {!state.help && remaining.map(index => <section key={index} className="grid gap-3 rounded-sm border border-line bg-surface p-4"><RecordForm initial={state.candidates[index]} source="scan" resolveDocumentId={resolveDocumentId} onSaved={() => remove(index)} /><Button type="button" variant="quiet" onClick={() => remove(index)}>{scan.discard}</Button></section>)}
      </div>
    </div>
  </Screen>;
}
