import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeRecord } from '../domain/testing';
import { EditRecord } from './AddRecord';

const getRecord = vi.hoisted(() => vi.fn());
vi.mock('../data/records', () => ({ getRecord, updateRecord: vi.fn() }));

beforeEach(() => { cleanup(); vi.clearAllMocks(); });

it('waits for a fresh edit fetch instead of showing a cached record', async () => {
  const old = makeRecord({ id: 'r1', title: 'Cached title', updatedAt: '2026-01-01T00:00:00Z' });
  const fresh = makeRecord({ id: 'r1', title: 'Fresh title', updatedAt: '2026-01-02T00:00:00Z' });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['record', 'r1'], old);
  let resolveFetch!: (value: typeof fresh) => void;
  getRecord.mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/records/r1/edit']}><Routes><Route path="/records/:id/edit" element={<EditRecord />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(screen.queryByDisplayValue('Cached title')).toBeNull();
  await waitFor(() => expect(getRecord).toHaveBeenCalledWith('r1'));
  resolveFetch(fresh);
  expect(await screen.findByDisplayValue('Fresh title')).not.toBeNull();
});
