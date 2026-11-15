import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeRecord } from '../domain/testing';
import { clinician } from '../copy/clinician';
import { ClinicianView } from './ClinicianView';

const api = vi.hoisted(() => ({ loadClinicianShare: vi.fn(), verifyClinicianRecord: vi.fn() }));
vi.mock('../data/clinician', () => api);
const token = 'A'.repeat(43);
const first = makeRecord({ id: 'r1', title: 'Metformin', type: 'medication', trustLevel: 'document_supported' });
const second = makeRecord({ id: 'r2', title: 'Losartan', type: 'medication', trustLevel: 'patient_entered' });

beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  api.loadClinicianShare.mockResolvedValue({ ok: true, data: { patient: { displayName: 'Lourdes Villareal', birthDate: '1968-03-12', sex: 'female', bloodType: 'O+' }, records: [first, second], expiresAt: '2099-01-01T00:00:00Z' } });
  api.verifyClinicianRecord.mockImplementation(async (_token: string, id: string, name: string) => ({ ok: true, record: { ...(id === 'r1' ? first : second), trustLevel: 'clinician_verified', verifiedBy: name } }));
});

function mount() {
  render(<MemoryRouter initialEntries={[`/s/${token}`]}><Routes><Route path="/s/:token" element={<ClinicianView />} /></Routes></MemoryRouter>);
}

it('renders shared records with trust badges and no navigation', async () => {
  mount();
  expect(await screen.findByText('Lourdes Villareal')).not.toBeNull();
  expect(screen.getByText('Metformin')).not.toBeNull();
  expect(screen.getByText('Losartan')).not.toBeNull();
  expect(screen.getAllByText('Supported by a document')).toHaveLength(2);
  expect(screen.queryByRole('navigation')).toBeNull();
});

it('asks for clinician details once and reuses them for the second record', async () => {
  mount();
  await screen.findByText('Metformin');
  await userEvent.click(screen.getAllByRole('button', { name: clinician.verify })[0]);
  await userEvent.type(screen.getByLabelText(clinician.name), 'Dr. Reyes');
  await userEvent.type(screen.getByLabelText(clinician.license), '0098123');
  await userEvent.click(screen.getByRole('button', { name: clinician.confirm }));
  await waitFor(() => expect(api.verifyClinicianRecord).toHaveBeenCalledWith(token, 'r1', 'Dr. Reyes', '0098123'));
  await userEvent.click(screen.getByRole('button', { name: clinician.verify }));
  await waitFor(() => expect(api.verifyClinicianRecord).toHaveBeenCalledWith(token, 'r2', 'Dr. Reyes', '0098123'));
  expect(screen.queryByLabelText(clinician.license)).toBeNull();
});

it('removes records when the link has ended on load', async () => {
  api.loadClinicianShare.mockResolvedValue({ ok: false, reason: 'ended' });
  mount();
  expect(await screen.findByText(clinician.ended)).not.toBeNull();
  expect(screen.queryByText('Metformin')).toBeNull();
});

it('omits patient facts that were not shared', async () => {
  api.loadClinicianShare.mockResolvedValue({ ok: true, data: { patient: { displayName: 'Lourdes Villareal', birthDate: null, sex: null, bloodType: null }, records: [], expiresAt: '2099-01-01T00:00:00Z' } });
  mount();
  expect(await screen.findByText('Lourdes Villareal')).not.toBeNull();
  expect(screen.queryByText(/years/)).toBeNull();
  expect(screen.queryByText(/Blood type/)).toBeNull();
});

it('removes all record text when verification gets a 410', async () => {
  api.verifyClinicianRecord.mockResolvedValue({ ok: false, reason: 'ended' });
  mount();
  await screen.findByText('Metformin');
  await userEvent.click(screen.getAllByRole('button', { name: clinician.verify })[0]);
  await userEvent.type(screen.getByLabelText(clinician.name), 'Dr. Reyes');
  await userEvent.type(screen.getByLabelText(clinician.license), '0098123');
  await userEvent.click(screen.getByRole('button', { name: clinician.confirm }));
  expect(await screen.findByText(clinician.ended)).not.toBeNull();
  expect(screen.queryByText('Metformin')).toBeNull();
  expect(screen.queryByText('Losartan')).toBeNull();
});
