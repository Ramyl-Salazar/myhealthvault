import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scan, screens } from '../copy';
import { prepareImage } from '../domain/extract/image';
import { readImage } from '../domain/extract/ocr';
import { needsHelp, parseDocumentText } from '../domain/extract/parse';
import { SAMPLES } from '../domain/extract/samples';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import type { ScanState } from './ScanConfirm';

export function ScanCapture() {
  const navigate = useNavigate();
  const [reading, setReading] = useState(false);

  async function readFile(file?: File) {
    if (!file) return;
    setReading(true);
    let image: Blob = file;
    let candidates: ScanState['candidates'] = [];
    let help = true;
    try {
      image = await prepareImage(file);
      const result = await readImage(image);
      candidates = parseDocumentText(result.text);
      help = needsHelp(result, candidates);
    } catch {
      // Keep the image available for manual entry when reading fails.
    } finally {
      setReading(false);
    }
    navigate('/scan/confirm', { state: { image, candidates, help } satisfies ScanState });
  }

  return <Screen title={screens.scan}>
    <p className="rounded-sm border border-line bg-surface p-4 text-sm text-ink">{scan.notice}</p>
    <div className="grid gap-3">
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-pill bg-primary px-4 font-semibold text-on-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">{scan.takePhoto}<input className="sr-only" aria-label={scan.takePhoto} type="file" accept="image/*" capture="environment" disabled={reading} onChange={event => void readFile(event.target.files?.[0])} /></label>
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-pill bg-primary-soft px-4 font-semibold text-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">{scan.choosePhoto}<input className="sr-only" aria-label={scan.choosePhoto} type="file" accept="image/*" disabled={reading} onChange={event => void readFile(event.target.files?.[0])} /></label>
    </div>
    {reading && <p role="status" className="rounded-sm bg-surface p-4 text-ink">{scan.reading}</p>}
    <section className="grid gap-3"><h2 className="text-lg font-bold">{scan.samples}</h2>
      {SAMPLES.map(sample => <Button key={sample.id} type="button" variant="soft" disabled={reading} onClick={() => navigate('/scan/confirm', { state: { sampleId: sample.id, imagePath: sample.imagePath, candidates: sample.candidates, help: false } satisfies ScanState })}>{scan.sampleNames[sample.id]}</Button>)}
    </section>
  </Screen>;
}
