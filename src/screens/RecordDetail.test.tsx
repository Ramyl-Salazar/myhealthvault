import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMedication } from '../domain/testing';
import { RecordDetail } from './RecordDetail';
import { screens } from '../copy';

const { getRecord, deleteRecord, documentUrl } = vi.hoisted(() => ({ getRecord: vi.fn(), deleteRecord: vi.fn(), documentUrl: vi.fn() }));
vi.mock('../data/records', () => ({ getRecord, deleteRecord }));
vi.mock('../data/documents', () => ({ documentUrl }));

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/records/r1']}><Routes><Route path="/records/:id" element={<RecordDetail />} /><Route path="/timeline" element={<div>{screens.timeline}</div>} /></Routes></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { cleanup(); vi.resetAllMocks(); });

describe('RecordDetail', () => {
  it('omits missing values and invalid date text', async () => {
    getRecord.mockResolvedValue(makeMedication('Medicine', {}, { id: 'r1', occurredOn: null, providerName: null }));
    renderDetail();
    expect(await screen.findByText('Medicine')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null|Invalid Date/);
  });

  it('shows the linked document through a signed URL', async () => {
    getRecord.mockResolvedValue(makeMedication('Medicine', {}, { id: 'r1', documentId: 'd1' }));
    documentUrl.mockResolvedValue('https://example.test/image.jpg');
    renderDetail();
    expect(await screen.findByRole('img', { name: 'Linked document' })).not.toBeNull();
    expect(documentUrl).toHaveBeenCalledWith('user-1/d1.jpg');
  });
});
