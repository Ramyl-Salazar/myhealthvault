import { Home, Clock3, Plus, Share2, Settings2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { nav } from '../copy';

const items = [
  { to: '/home', label: nav.home, icon: Home, match: /^\/home(?:\/|$)/ },
  { to: '/timeline', label: nav.timeline, icon: Clock3, match: /^\/timeline(?:\/|$)/ },
  { to: '/add', label: nav.add, icon: Plus, match: /^\/(?:add|scan|records)(?:\/|$)/ },
  { to: '/share', label: nav.share, icon: Share2, match: /^\/share(?:\/|$)/ },
  { to: '/settings', label: nav.settings, icon: Settings2, match: /^\/(?:settings|print)(?:\/|$)/ },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return <nav aria-label={nav.label} className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
    {items.map(({ to, label, icon: Icon, match }) => {
      const active = match.test(pathname);
      const add = to === '/add';
      return <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={`flex min-h-16 min-w-11 flex-col items-center justify-center gap-1 text-xs no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? 'font-semibold text-primary' : 'text-ink-muted'}`}>
        <span className={`grid place-items-center rounded-pill ${add ? '-mt-5 size-12 bg-primary text-on-primary' : 'h-7 w-13'} ${active && !add ? 'bg-primary-soft' : ''}`}><Icon size={add ? 24 : 20} strokeWidth={1.9} aria-hidden="true" /></span>
        {label}
      </Link>;
    })}
  </nav>;
}
