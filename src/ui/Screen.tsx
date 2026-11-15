import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { DemoMarker } from './DemoMarker';

export function Screen({ title, children, nav = true, headerLeading, subtitle }: { title: string; children: ReactNode; nav?: boolean; headerLeading?: ReactNode; subtitle?: string }) {
  return <div className="app-column mx-auto flex min-h-dvh w-full flex-col bg-bg text-ink">
    <header className="flex items-center justify-between gap-3 px-4 pt-4">
      <div className="flex min-w-0 items-center gap-3">{headerLeading}<div className="min-w-0"><h1 className="text-xl leading-tight font-bold wrap-break-word">{title}</h1>{subtitle && <p className="mt-1 text-xs text-ink-muted tabular-nums">{subtitle}</p>}</div></div>
      <DemoMarker />
    </header>
    <main className="flex flex-1 flex-col gap-5 px-4 pt-4 pb-6">{children}</main>
    {nav && <BottomNav />}
  </div>;
}
