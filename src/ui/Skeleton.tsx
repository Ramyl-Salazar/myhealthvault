import { common } from '../copy';

export function Skeleton() {
  return <div role="status" aria-label={common.loading} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
    <span className="h-4 w-1/2 rounded-pill bg-line" /><span className="h-4 w-full rounded-pill bg-line" /><span className="h-4 w-3/4 rounded-pill bg-line" />
  </div>;
}
