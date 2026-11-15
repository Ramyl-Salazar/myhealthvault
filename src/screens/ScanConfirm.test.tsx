import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { ScanConfirm, type ScanState } from './ScanConfirm';
import { screens } from '../copy/screens';

const { createRecord, uploadDocument, readWithGoogle } = vi.hoisted(() => ({ createRecord: vi.fn(), uploadDocument: vi.fn(), readWithGoogle: vi.fn() }));
vi.mock('../domain/extract/image', () => ({ prepareImage: vi.fn(async (blob: Blob) => blob) }));
vi.mock('../data/records', () => ({ createRecord }));
vi.mock('../data/documents', () => ({ uploadDocument }));
vi.mock('../data/readWithGoogle', () => ({ readWithGoogle }));

const CONSENT = 'Google AI can try to read this page. The photo will be sent to Google, and Google may use it to improve its products.';
const FALLBACK = 'Google AI is not available right now. You can type the details in.';
const candidate = { type: 'diagnosis' as const, title: 'Hypertension', occurredOn: null, providerName: null, details: { kind: 'diagnosis' as const } };

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  uploadDocument.mockResolvedValue({ id: 'doc-1', storagePath: 'u/doc-1.jpg' });
  createRecord.mockResolvedValue({ id: 'record-1' });
});

function mount() {
  const state: ScanState = { image: new Blob(['image'], { type: 'image/jpeg' }), candidates: [], help: true };
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[{ pathname: '/scan/confirm', state }]}><Routes><Route path="/scan/confirm" element={<ScanConfirm />} /><Route path="/timeline" element={<p>{screens.timeline}</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

async function openConsent() {
  mount();
  await userEvent.click(screen.getByRole('button', { name: 'Read with Google AI' }));
}

it('shows the consent text and sends nothing until Send to Google AI is pressed', async () => {
  readWithGoogle.mockResolvedValue({ ok: true, candidates: [candidate] });
  await openConsent();
  expect(screen.getByText(CONSENT)).not.toBeNull();
  expect(uploadDocument).not.toHaveBeenCalled();
  expect(readWithGoogle).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Send to Google AI' }));
  await waitFor(() => expect(readWithGoogle).toHaveBeenCalledWith('doc-1'));
  expect(uploadDocument).toHaveBeenCalledTimes(1);
});

it('shows the returned candidates and links a saved one to the uploaded page without a second upload', async () => {
  readWithGoogle.mockResolvedValue({ ok: true, candidates: [candidate] });
  await openConsent();
  await userEvent.click(screen.getByRole('button', { name: 'Send to Google AI' }));
  expect(((await screen.findByRole('textbox', { name: 'Title' })) as HTMLInputElement).value).toBe('Hypertension');
  await userEvent.click(screen.getByRole('button', { name: 'Save record' }));
  await waitFor(() => expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ source: 'scan', documentId: 'doc-1', title: 'Hypertension' })));
  expect(uploadDocument).toHaveBeenCalledTimes(1);
});

it('opens the manual form with the fixed text when the limit is reached', async () => {
  readWithGoogle.mockResolvedValue({ ok: false, reason: 'limit' });
  await openConsent();
  await userEvent.click(screen.getByRole('button', { name: 'Send to Google AI' }));
  expect(await screen.findByText(FALLBACK)).not.toBeNull();
  expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value).toBe('');
});

it('opens the manual form with the fixed text when Google AI is unavailable', async () => {
  readWithGoogle.mockResolvedValue({ ok: false, reason: 'unavailable' });
  await openConsent();
  await userEvent.click(screen.getByRole('button', { name: 'Send to Google AI' }));
  expect(await screen.findByText(FALLBACK)).not.toBeNull();
  expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeNull();
});

it('opens the manual form with the fixed text when the page cannot be uploaded', async () => {
  uploadDocument.mockRejectedValue(new Error('offline'));
  await openConsent();
  await userEvent.click(screen.getByRole('button', { name: 'Send to Google AI' }));
  expect(await screen.findByText(FALLBACK)).not.toBeNull();
  expect(readWithGoogle).not.toHaveBeenCalled();
});

it('says Google AI found nothing and opens the manual form when no candidates come back', async () => {
  readWithGoogle.mockResolvedValue({ ok: true, candidates: [] });
  await openConsent();
  await userEvent.click(screen.getByRole('button', { name: 'Send to Google AI' }));
  expect(await screen.findByText('Google AI could not read this page either. You can type the details in.')).not.toBeNull();
  expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeNull();
});

it('lets the user decline at the consent step and type it in', async () => {
  await openConsent();
  await userEvent.click(screen.getByRole('button', { name: 'Type it in myself' }));
  expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeNull();
  expect(uploadDocument).not.toHaveBeenCalled();
  expect(readWithGoogle).not.toHaveBeenCalled();
  expect(screen.queryByText(CONSENT)).toBeNull();
});
