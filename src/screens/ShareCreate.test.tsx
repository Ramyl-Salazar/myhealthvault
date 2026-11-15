import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeRecord } from '../domain/testing';
import { share } from '../copy/share';
import { ShareCreate } from './ShareCreate';
import { ShareDetail } from './ShareDetail';
import { ShareList } from './ShareList';

const api = vi.hoisted(() => ({ listRecords: vi.fn(), createShare: vi.fn(), listShares: vi.fn(), getShareLog: vi.fn(), revokeShare: vi.fn() }));
vi.mock('../data/records', () => ({ listRecords: api.listRecords }));
vi.mock('../data/shares', () => api);

const active = makeRecord({ id: 'active', title: 'Metformin', status: 'active' });
const resolved = makeRecord({ id: 'resolved', title: 'Old visit', status: 'resolved' });
const liveShare = { id: 'share-1', label: 'Shared record', recordIds: ['active'], expiresAt: '2099-01-01T00:00:00Z', revokedAt: null, createdAt: '2026-11-16T00:00:00Z' };

beforeEach(() => {
  cleanup(); vi.clearAllMocks(); sessionStorage.clear();
  api.listRecords.mockResolvedValue([active, resolved]);
  api.createShare.mockResolvedValue({ id: 'share-1', url: 'https://example.test/s/token', expiresAt: liveShare.expiresAt });
  api.listShares.mockResolvedValue([liveShare]);
  api.getShareLog.mockResolvedValue([]);
  api.revokeShare.mockResolvedValue(undefined);
});

function mount(start: string) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[start]}><Routes><Route path="/share" element={<ShareList />} /><Route path="/share/new" element={<ShareCreate />} /><Route path="/share/:id" element={<ShareDetail />} /></Routes></MemoryRouter></QueryClientProvider>);
}

it('shares only active records for everything current and maps one hour to 60 minutes', async () => {
  mount('/share/new');
  await screen.findByText('Metformin');
  await userEvent.selectOptions(screen.getByLabelText(share.duration), '60');
  await userEvent.click(screen.getByRole('button', { name: share.create }));
  await waitFor(() => expect(api.createShare).toHaveBeenCalledWith({ label: share.defaultName, recordIds: ['active'], minutes: 60 }));
  expect(await screen.findByDisplayValue('https://example.test/s/token')).not.toBeNull();
});

it('blocks a share with no records selected', async () => {
  api.listRecords.mockResolvedValue([]);
  mount('/share/new');
  await userEvent.click(await screen.findByRole('button', { name: share.create }));
  expect(screen.getByRole('alert').textContent).toContain(share.chooseRecords);
  expect(api.createShare).not.toHaveBeenCalled();
});

it('shows viewed and verified log entries and ends a share', async () => {
  api.getShareLog.mockResolvedValue([{ id: '1', action: 'viewed', recordId: null, device: 'Browser', createdAt: '2026-11-16T10:00:00Z' }, { id: '2', action: 'verified', recordId: 'active', device: 'Browser', createdAt: '2026-11-16T10:05:00Z' }]);
  api.revokeShare.mockImplementation(async () => { api.listShares.mockResolvedValue([{ ...liveShare, revokedAt: '2026-11-16T11:00:00Z' }]); });
  mount('/share/share-1');
  expect(await screen.findByText(share.viewed)).not.toBeNull();
  expect(screen.getByText(share.verified)).not.toBeNull();
  expect(document.querySelectorAll('time')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: share.stop }));
  await waitFor(() => expect(api.revokeShare).toHaveBeenCalledWith('share-1'));
  expect(await screen.findByText(share.ended)).not.toBeNull();
});

it('shows an ended share without a QR code', async () => {
  api.listShares.mockResolvedValue([{ ...liveShare, revokedAt: '2026-11-16T11:00:00Z' }]);
  mount('/share/share-1');
  expect(await screen.findByText(share.ended)).not.toBeNull();
  expect(screen.queryByLabelText(share.qrLabel)).toBeNull();
});
