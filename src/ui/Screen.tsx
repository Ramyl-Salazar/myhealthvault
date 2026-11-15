import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { DemoMarker } from './DemoMarker';

export function Screen({ title, children, nav = true }: { title: string; children: ReactNode; nav?: boolean }) {
  return <div className="app-column mx-auto flex min-h-dvh w-full flex-col bg-bg text-ink">
    <header className="flex items-center justify-between gap-3 px-4 pt-4">
      <h1 className="min-w-0 text-xl leading-tight font-bold wrap-break-word">{title}</h1>
      <DemoMarker />
    </header>
    <main className="flex flex-1 flex-col gap-5 px-4 pt-4 pb-6">{children}</main>
    {nav && <BottomNav />}
  </div>;
}
