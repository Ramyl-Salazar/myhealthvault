import { Link } from 'react-router-dom';
import { emergency } from '../copy/emergency';
import { formatDate } from '../domain/dates';
import { loadEmergencyCard } from '../domain/emergency';

export function EmergencyCard() {
  const card = loadEmergencyCard();
  if (!card) return <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-bg p-6 text-ink"><h1 className="text-2xl font-bold">{emergency.title}</h1><p>{emergency.empty}</p><Link className="text-primary underline" to="/">{emergency.appName}</Link></main>;
  const section = (title: string, values: string[]) => <section className="rounded-md bg-white p-5 shadow-card"><h2 className="mb-3 text-lg font-bold">{title}</h2>{values.length ? <ul className="space-y-2">{values.map((value, index) => <li key={`${value}-${index}`} className="text-lg">{value}</li>)}</ul> : <p>{emergency.none}</p>}</section>;
  return <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-8 text-ink">
    <header className="bg-cat-allergy px-6 py-8 text-white"><h1 className="text-2xl font-bold">{emergency.title}</h1><p className="mt-2 text-xl font-semibold">{card.name}</p><p className="mt-4 text-sm">{emergency.bloodType}</p><p className="text-5xl font-bold">{card.bloodType ?? emergency.none}</p></header>
    <div className="space-y-4 p-4">{section(emergency.allergies, card.allergies)}{section(emergency.conditions, card.conditions)}{section(emergency.medications, card.medications)}
      <section className="rounded-md bg-white p-5 shadow-card"><h2 className="mb-3 text-lg font-bold">{emergency.contacts}</h2>{card.contacts.length ? <ul className="space-y-3">{card.contacts.map((contact, index) => <li key={`${contact.phone}-${index}`}><a className="flex min-h-11 flex-col justify-center rounded-md bg-primary-soft px-4 py-2 text-primary underline focus-visible:outline-2 focus-visible:outline-primary" href={`tel:${contact.phone}`}><span className="font-semibold">{contact.name} · {contact.relation}</span><span>{contact.phone}</span></a></li>)}</ul> : <p>{emergency.none}</p>}</section>
      <p className="text-sm text-ink-muted">{emergency.saved(formatDate(card.savedAt.slice(0, 10)))}</p>
    </div>
  </main>;
}
