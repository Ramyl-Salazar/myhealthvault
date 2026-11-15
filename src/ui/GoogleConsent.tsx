import { scan } from '../copy';
import { Button } from './Button';

/** Shown every time, right before a page is sent to Google AI. Nothing is sent until onSend. */
export function GoogleConsent({ busy, onSend, onManual }: { busy: boolean; onSend: () => void; onManual: () => void }) {
  return <section aria-label={scan.google} aria-busy={busy} className="grid gap-3 rounded-sm border border-line bg-surface p-4">
    <p>{scan.googleConsent}</p>
    <Button type="button" busy={busy} aria-label={busy ? scan.googleSending : undefined} onClick={onSend}>{scan.googleSend}</Button>
    <Button type="button" variant="soft" disabled={busy} onClick={onManual}>{scan.manual}</Button>
  </section>;
}
