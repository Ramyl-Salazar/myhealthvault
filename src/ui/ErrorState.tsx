import { common } from '../copy';
import { Button } from './Button';

export function ErrorState({ message = common.loadError, onRetry }: { message?: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-col items-start gap-3 rounded-md bg-surface p-4 text-sm text-ink shadow-card">
    <p>{message}</p><Button size="sm" variant="soft" onClick={onRetry}>{common.retry}</Button>
  </div>;
}
