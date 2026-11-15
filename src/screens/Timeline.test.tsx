import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMedication, makeRecord } from '../domain/testing';
import { Timeline } from './Timeline';

const { listRecords } = vi.hoisted(() => ({ listRecords: vi.fn() }));
vi.mock('../data/records', () => ({ listRecords }));

function renderTimeline() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Timeline /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Timeline', () => {
  it('shows records newest first and filters medications', async () => {
    listRecords.mockResolvedValue([
      makeRecord({ id: 'old', title: 'Old condition', occurredOn: '2024-01-01' }),
      makeMedication('New medicine', {}, { id: 'new', occurredOn: '2026-11-01' }),
    ]);
    renderTimeline();
    expect((await screen.findAllByRole('link', { name: /New medicine|Old condition/ })).map(el => el.textContent?.includes('New medicine'))).toEqual([true, false]);
    await userEvent.click(screen.getByRole('button', { name: 'Medicines' }));
    expect(screen.getByText('New medicine')).not.toBeNull();
    expect(screen.queryByText('Old condition')).toBeNull();
  });

  it('shows an add action when empty', async () => {
    listRecords.mockResolvedValue([]);
    renderTimeline();
    expect(await screen.findByRole('link', { name: 'Add a record' })).not.toBeNull();
  });

  it('shows a retryable error after load failure', async () => {
    listRecords.mockRejectedValue(new Error('offline'));
    renderTimeline();
    expect(await screen.findByRole('alert')).not.toBeNull();
    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' })).not.toBeNull();
  });

  it('keeps a long title wrappable and groups missing dates last', async () => {
    listRecords.mockResolvedValue([
      makeMedication('A'.repeat(200), {}, { id: 'undated', occurredOn: null, providerName: null }),
      makeRecord({ title: 'Dated', occurredOn: '2026-02-01' }),
    ]);
    renderTimeline();
    const longTitle = await screen.findByText('A'.repeat(200));
    expect(longTitle.className).toContain('wrap-anywhere');
    expect(screen.getByText('Date not recorded')).not.toBeNull();
    expect(screen.getByText('Dated').compareDocumentPosition(longTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
