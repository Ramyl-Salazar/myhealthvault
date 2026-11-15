import { offline } from '../copy';
import { useOnline } from './useOnline';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return <div role="status" className="sticky top-0 z-50 border-b border-line bg-patient-soft px-4 py-3 text-center text-sm font-semibold text-patient">{offline.banner}</div>;
}

export function OfflineActionReason() {
  const online = useOnline();
  return online ? null : <p className="text-sm text-ink-muted">{offline.action}</p>;
}
