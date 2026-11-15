import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { Settings } from './Settings';

const mocks = vi.hoisted(() => ({ sex: 'female', getProfile: vi.fn(async () => ({ id: 'p', displayName: 'Demo patient', birthDate: '1968-03-12', sex: mocks.sex, bloodType: null, emergencyContacts: [], emergencyConsent: true })), resetDemo: vi.fn(async () => {}), deleteEverything: vi.fn(async () => {}), clearEmergencyCard: vi.fn(), updateProfile: vi.fn(async (patch: Record<string, unknown>) => ({ id: 'p', displayName: 'Demo patient', birthDate: '1968-03-12', sex: mocks.sex, bloodType: null, emergencyContacts: [], emergencyConsent: true, ...patch })) }));
const entryPage = 'Entry page';
vi.mock('../data/session', () => ({ resetDemo: mocks.resetDemo }));
vi.mock('../data/deleteData', () => ({ deleteEverything: mocks.deleteEverything }));
vi.mock('../domain/emergency', () => ({ clearEmergencyCard: mocks.clearEmergencyCard }));
vi.mock('../data/profile', () => ({ getProfile: mocks.getProfile, updateProfile: mocks.updateProfile }));
vi.mock('../screens/PinLock', () => ({ PinSetup: () => null }));

const renderSettings = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/settings']}><Routes><Route path="/settings" element={<Settings />} /><Route path="/" element={<p>{entryPage}</p>} /></Routes></MemoryRouter></QueryClientProvider>);
beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.sex = 'female'; });
it('requires typing delete before deleting', async () => {
  renderSettings();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete everything' }));
  expect(mocks.deleteEverything).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Type delete to confirm'), { target: { value: 'delete' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));
  await waitFor(() => expect(mocks.deleteEverything).toHaveBeenCalledOnce());
  expect(await screen.findByText(entryPage)).not.toBeNull();
});
it('accepts delete in any capitals with surrounding spaces', async () => {
  renderSettings();
  fireEvent.change(await screen.findByLabelText('Type delete to confirm'), { target: { value: '  DeLeTe  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));
  await waitFor(() => expect(mocks.deleteEverything).toHaveBeenCalledOnce());
});
it('keeps unsaved profile edits during a profile refetch', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Settings /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Unsaved name' } });
  act(() => { client.setQueryData(['profile'], { id: 'p', displayName: 'Server name', birthDate: '1968-03-12', sex: 'female', bloodType: null, emergencyContacts: [], emergencyConsent: true }); });
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Unsaved name');
});
it('keeps the emergency card when turning consent off fails', async () => {
  mocks.updateProfile.mockRejectedValueOnce(new Error('offline'));
  renderSettings();
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Save an emergency card on this device' }));
  await screen.findByText('Could not complete this action. Try again.');
  expect(mocks.clearEmergencyCard).not.toHaveBeenCalled();
});
it('resets demo and clears the card when consent is turned off', async () => {
  renderSettings();
  fireEvent.click(await screen.findByRole('button', { name: 'Reset demo data' }));
  expect(mocks.resetDemo).not.toHaveBeenCalled();
  expect(screen.getByText('This replaces your records with the demo data. Continue?')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(mocks.resetDemo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Reset demo data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  await waitFor(() => expect(mocks.resetDemo).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Save an emergency card on this device' }));
  await waitFor(() => expect(mocks.clearEmergencyCard).toHaveBeenCalledOnce());
});
it('shows the stored birth date without browser date formatting and saves ISO', async () => {
  renderSettings();
  expect((await screen.findByLabelText('Day') as HTMLInputElement).value).toBe('12');
  expect((screen.getByLabelText('Month') as HTMLSelectElement).selectedOptions[0].text).toBe('Mar');
  expect((screen.getByLabelText('Year') as HTMLInputElement).value).toBe('1968');
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: '13' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ birthDate: '1968-03-13' })));
});
it('rejects an unreadable birth date without saving', async () => {
  renderSettings();
  fireEvent.change(await screen.findByLabelText('Day'), { target: { value: '31' } });
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(await screen.findByText('Enter a real birth date.')).not.toBeNull();
  expect(mocks.updateProfile).not.toHaveBeenCalled();
});
it('shows an unknown stored sex without changing it', async () => {
  mocks.sex = 'custom value';
  renderSettings();
  const sex = await screen.findByRole('combobox', { name: 'Sex' }) as HTMLSelectElement;
  expect(sex.value).toBe('custom value');
  expect(sex.selectedOptions[0].text).toBe('custom value');
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ sex: 'custom value' })));
});
