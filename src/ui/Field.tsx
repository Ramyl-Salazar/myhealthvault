import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; note?: string };

export function Field({ label, id, note, className = '', ...props }: Props) {
  return <div className="flex flex-col gap-1">
    <label htmlFor={id} className="text-sm text-ink-muted">{label}</label>
    <input {...props} id={id} className={`min-h-12 w-full rounded-sm border border-line bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`} />
    {note && <p className="text-xs text-ink-muted">{note}</p>}
  </div>;
}
