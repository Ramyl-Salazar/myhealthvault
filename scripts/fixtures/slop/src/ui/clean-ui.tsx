import { useState } from 'react';
import { common } from '../copy/clean-react';

export function Toggle({ values }: { values: number[] }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const big = values.filter((v) => v > 10);
  if (big.length > 2) return <hr />;
  return (
    <div>
      {open && <span className="text-sm" />}
      {values.map((v) => (
        <button key={v} type="button" onClick={() => setOpen(v > 1)}>
          {common.title}
        </button>
      ))}
    </div>
  );
}
