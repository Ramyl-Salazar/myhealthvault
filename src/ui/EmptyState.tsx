import { common } from '../copy';

export function EmptyState({ message = common.placeholder }: { message?: string }) {
  return <div className="rounded-md bg-surface p-4 text-sm text-ink-muted shadow-card" role="status">{message}</div>;
}
