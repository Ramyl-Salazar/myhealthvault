import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { ScanCapture } from './ScanCapture';
import { ScanConfirm } from './ScanConfirm';
import { screens } from '../copy/screens';

const { readImage, createRecord, uploadDocument, readWithGoogle } = vi.hoisted(() => ({ readImage: vi.fn(), createRecord: vi.fn(), uploadDocument: vi.fn(), readWithGoogle: vi.fn() }));
vi.mock('../domain/extract/ocr', () => ({ readImage }));
vi.mock('../domain/extract/image', () => ({ prepareImage: vi.fn(async (blob: Blob) => blob) }));
vi.mock('../data/records', () => ({ createRecord }));
vi.mock('../data/documents', () => ({ uploadDocument }));
vi.mock('../data/readWithGoogle', () => ({ readWithGoogle }));

beforeEach(() => { cleanup(); vi.clearAllMocks(); uploadDocument.mockResolvedValue({ id: 'doc-1' }); createRecord.mockResolvedValue({ id: 'record-1' }); readWithGoogle.mockResolvedValue({ ok: false, reason: 'unavailable' }); });

function mount() {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/scan']}><Routes><Route path="/scan" element={<ScanCapture />} /><Route path="/scan/confirm" element={<ScanConfirm />} /><Route path="/timeline" element={<p>{screens.timeline}</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

it('shows the demo notice and uses saved sample candidates without OCR', async () => {
  mount();
  expect(screen.getByText('This is a public demo. Do not upload real medical documents.')).not.toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /prescription sample/i }));
  expect((await screen.findAllByRole('textbox', { name: 'Title' }) as HTMLInputElement[])[0].value).toBe('Metformin');
  expect(readImage).not.toHaveBeenCalled();
});

it('offers manual entry when the read has no candidates', async () => {
  readImage.mockResolvedValue({ text: '', confidence: 20 });
  mount();
  const input = screen.getByLabelText('Choose a photo') as HTMLInputElement;
  await userEvent.upload(input, new File(['image'], 'test.png', { type: 'image/png' }));
  expect(await screen.findByText('The app could not read this page clearly.')).not.toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Type it in myself' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeNull());
});

it('uploads a sample only on save and links the scan record to it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['sample'], { type: 'image/png' }) }));
  mount();
  await userEvent.click(screen.getByRole('button', { name: /prescription sample/i }));
  expect(uploadDocument).not.toHaveBeenCalled();
  await userEvent.click(screen.getAllByRole('button', { name: 'Save record' })[0]);
  await waitFor(() => expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ source: 'scan', documentId: 'doc-1' })));
  expect(uploadDocument).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

it('discards all sample candidates without saving', async () => {
  mount();
  await userEvent.click(screen.getByRole('button', { name: /prescription sample/i }));
  for (let index = 0; index < 3; index++) await userEvent.click(screen.getAllByRole('button', { name: 'Discard' })[0]);
  expect(await screen.findByText(screens.timeline)).not.toBeNull();
  expect(createRecord).not.toHaveBeenCalled();
  expect(uploadDocument).not.toHaveBeenCalled();
});

it('offers manual entry when OCR fails', async () => {
  readImage.mockRejectedValue(new Error('OCR failed'));
  mount();
  await userEvent.upload(screen.getByLabelText('Choose a photo'), new File(['image'], 'test.png', { type: 'image/png' }));
  expect(await screen.findByText('The app could not read this page clearly.')).not.toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Type it in myself' }));
  expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeNull();
});

it('calls Google only after the choice is pressed and falls back to manual entry', async () => {
  readImage.mockResolvedValue({ text: '', confidence: 20 });
  mount();
  await userEvent.upload(screen.getByLabelText('Choose a photo'), new File(['image'], 'test.png', { type: 'image/png' }));
  expect(await screen.findByText('The app could not read this page clearly.')).not.toBeNull();
  expect(readWithGoogle).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Read with Google AI' }));
  expect(readWithGoogle).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Google AI is not available right now. You can type the details in.')).not.toBeNull();
  expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeNull();
});

it('returns to capture if confirmation is reloaded without route state', () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/scan/confirm']}><Routes><Route path="/scan" element={<ScanCapture />} /><Route path="/scan/confirm" element={<ScanConfirm />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText('This is a public demo. Do not upload real medical documents.')).not.toBeNull();
});
