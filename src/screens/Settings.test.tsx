import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { Settings } from './Settings';

const mocks = vi.hoisted(() => ({ resetDemo: vi.fn(async () => {}), deleteEverything: vi.fn(async () => {}), clearEmergencyCard: vi.fn(), updateProfile: vi.fn(async (patch: Record<string, unknown>) => ({ id: 'p', displayName: 'Demo patient', birthDate: null, sex: null, bloodType: null, emergencyContacts: [], emergencyConsent: true, ...patch })) }));
const entryPage = 'Entry page';
vi.mock('../data/session', () => ({ resetDemo: mocks.resetDemo }));
vi.mock('../data/deleteData', () => ({ deleteEverything: mocks.deleteEverything }));
vi.mock('../domain/emergency', () => ({ clearEmergencyCard: mocks.clearEmergencyCard }));
vi.mock('../data/profile', () => ({ getProfile: vi.fn(async () => ({ id: 'p', displayName: 'Demo patient', birthDate: null, sex: null, bloodType: null, emergencyContacts: [], emergencyConsent: true })), updateProfile: mocks.updateProfile }));
vi.mock('../screens/PinLock', () => ({ PinSetup: () => null }));

const renderSettings = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/settings']}><Routes><Route path="/settings" element={<Settings />} /><Route path="/" element={<p>{entryPage}</p>} /></Routes></MemoryRouter></QueryClientProvider>);
beforeEach(() => { cleanup(); vi.clearAllMocks(); });
it('requires typing delete before deleting', async () => {
  renderSettings();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete everything' }));
  expect(mocks.deleteEverything).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Type delete to confirm'), { target: { value: 'delete' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));
  await waitFor(() => expect(mocks.deleteEverything).toHaveBeenCalledOnce());
  expect(await screen.findByText(entryPage)).not.toBeNull();
});
it('resets demo and clears the card when consent is turned off', async () => {
  renderSettings();
  fireEvent.click(await screen.findByRole('button', { name: 'Reset demo data' }));
  await waitFor(() => expect(mocks.resetDemo).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Save an emergency card on this device' }));
  await waitFor(() => expect(mocks.clearEmergencyCard).toHaveBeenCalledOnce());
});
