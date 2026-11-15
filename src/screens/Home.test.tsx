import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { common, home, reminders } from '../copy';
import { makeMedication, makeRecord } from '../domain/testing';
import { formatDate } from '../domain/dates';
import { Home } from './Home';

const { listRecords, getProfile, listDismissed, dismissReminder } = vi.hoisted(() => ({ listRecords: vi.fn(), getProfile: vi.fn(), listDismissed: vi.fn(), dismissReminder: vi.fn() }));
vi.mock('../data/records', () => ({ listRecords }));
vi.mock('../data/profile', () => ({ getProfile }));
vi.mock('../data/reminders', () => ({ listDismissed, dismissReminder }));

const seeded = [
  makeRecord({ id: 'c1', type: 'diagnosis', title: 'Type 2 diabetes' }),
  makeRecord({ id: 'c2', type: 'diagnosis', title: 'Hypertension' }),
  makeRecord({ id: 'a1', type: 'allergy', title: 'Penicillin', details: { kind: 'allergy', reaction: 'Rash', severity: 'moderate' } }),
  makeMedication('Metformin', { genericName: 'Metformin' }, { id: 'm1' }),
  makeMedication('Glucophage', {}, { id: 'm2' }),
  makeMedication('Losartan', {}, { id: 'm3' }),
];

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Home /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  cleanup(); vi.resetAllMocks(); vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  getProfile.mockResolvedValue({ displayName: 'Lourdes Villanueva' });
  listDismissed.mockResolvedValue(new Set());
  dismissReminder.mockResolvedValue(undefined);
});

describe('Home', () => {
  it('shows two conditions, one allergy and three medicines from seeded records', async () => {
    listRecords.mockResolvedValue(seeded);
    mount();
    expect(await screen.findByText('Type 2 diabetes')).not.toBeNull();
    expect(within(screen.getByRole('region', { name: home.conditions })).getAllByRole('listitem')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: home.allergies })).getAllByRole('listitem')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: home.medications })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('names the duplicate and removes it when dismissed', async () => {
    listRecords.mockResolvedValue(seeded);
    mount();
    expect(await screen.findByText(/Possible duplicate: Metformin, Glucophage/)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: reminders.dismiss }));
    expect(dismissReminder).toHaveBeenCalledWith('dup:metformin');
    await waitFor(() => expect(screen.queryByText(/Possible duplicate: Metformin, Glucophage/)).toBeNull());
  });

  it('shows each summary section empty and no caution with no records', async () => {
    listRecords.mockResolvedValue([]);
    mount();
    expect(await screen.findByText(home.empty.conditions)).not.toBeNull();
    expect(screen.getByText(home.empty.allergies)).not.toBeNull();
    expect(screen.getByText(home.empty.medications)).not.toBeNull();
    expect(screen.getByText(home.empty.recentLabs)).not.toBeNull();
    expect(screen.getByText(home.empty.lastVisits)).not.toBeNull();
    expect(screen.queryByText(common.caution)).toBeNull();
  });

  it('shows the caution exactly once while a reminder is visible', async () => {
    listRecords.mockResolvedValue(seeded);
    mount();
    expect(await screen.findByText(/Possible duplicate:/)).not.toBeNull();
    expect(screen.getAllByText(common.caution)).toHaveLength(1);
  });

  it('uses the local date and updates at local midnight', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T07:30:00Z'));
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(['records'], []);
    client.setQueryData(['profile'], { displayName: 'Lourdes Villanueva' });
    client.setQueryData(['dismissed'], new Set());
    render(<QueryClientProvider client={client}><MemoryRouter><Home /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByText(formatDate('2026-11-14'))).not.toBeNull();
    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });
    expect(screen.getByText(formatDate('2026-11-15'))).not.toBeNull();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
});
