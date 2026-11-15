import { common } from '../copy';
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';

export function Placeholder({ title, nav = true }: { title: string; nav?: boolean }) {
  return <Screen title={title} nav={nav}><EmptyState message={common.placeholder} /></Screen>;
}
