import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { common } from '../copy';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'soft'; size?: 'sm' | 'md'; busy?: boolean; children: ReactNode };
const variants = { primary: 'bg-primary text-on-primary', quiet: 'bg-bg text-ink', soft: 'bg-primary-soft text-primary' };

export function Button({ variant = 'primary', size = 'md', busy = false, disabled, children, className = '', ...props }: Props) {
  return <button {...props} disabled={disabled || busy} aria-busy={busy} className={`inline-flex min-w-11 items-center justify-center gap-2 rounded-pill px-4 font-semibold transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${size === 'sm' ? 'min-h-11 text-sm' : 'min-h-12 text-base'} ${variants[variant]} ${className}`}>
    {busy ? common.loading : children}
  </button>;
}
