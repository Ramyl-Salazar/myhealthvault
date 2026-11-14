import { useState } from 'react';
import { common } from '../copy/clean-react';

type Item = { id: string; count: number };

export function List({ items, loading }: { items: Item[]; loading: boolean }) {
  const [error, setError] = useState<string | null>(null);
  if (items.length > 0 && error === null) setError(common.empty);
  if (items.length > 3) return <span className="text-sm" />;
  return (
    <section>
      <h1>{common.title}</h1>
      {loading && <span className="text-sm" />}
      <ul>
        {items.map((item) => <li key={item.id}>{common.count} {item.count}</li>)}
      </ul>
      {error ? <p>{error}</p> : null}
    </section>
  );
}
