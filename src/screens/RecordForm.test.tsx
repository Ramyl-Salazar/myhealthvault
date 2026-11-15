import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordType } from '../domain/types';
import { makeRecord } from '../domain/testing';
import { form } from '../copy/form';
import { SAMPLES } from '../domain/extract/samples';
import { RecordForm } from './RecordForm';

const { createRecord, updateRecord } = vi.hoisted(() => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../data/records', () => ({ createRecord, updateRecord }));

function mount() {
  const saved = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><RecordForm onSaved={saved} /></MemoryRouter></QueryClientProvider>);
  return saved;
}

beforeEach(() => { cleanup(); vi.resetAllMocks(); createRecord.mockResolvedValue({ id: 'r1', trustLevel: 'patient_entered' }); });

describe('RecordForm', () => {
  it.each([
    ['diagnosis', form.types.diagnosis],
    ['allergy', form.types.allergy],
    ['medication', form.types.medication],
    ['lab_result', form.types.lab_result],
    ['immunization', form.types.immunization],
    ['procedure', form.types.procedure],
    ['visit', form.types.visit],
  ] as [RecordType, string][])('saves %s details with patient trust', async (type, label) => {
    const saved = mount();
    await userEvent.click(screen.getByRole('button', { name: label }));
    await userEvent.type(screen.getByRole('textbox', { name: form.title }), 'A record');
    await userEvent.click(screen.getByRole('button', { name: form.save }));
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ type, details: expect.objectContaining({ kind: type }), source: 'manual' }));
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ trustLevel: 'patient_entered' }));
  });

  it('blocks an empty title with a field message', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: form.save }));
    expect(await screen.findByText(form.titleRequired)).not.toBeNull();
    expect(createRecord).not.toHaveBeenCalled();
  });

  it('blocks a lab row with only a unit until it is completed or removed', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: form.types.lab_result }));
    await userEvent.type(screen.getByRole('textbox', { name: form.title }), 'Lab report');
    await userEvent.click(screen.getByRole('button', { name: form.addResult }));
    await userEvent.type(screen.getAllByRole('textbox', { name: form.resultUnit })[1], 'mg/dL');
    await userEvent.click(screen.getByRole('button', { name: form.save }));
    expect(await screen.findByText(form.resultIncomplete)).not.toBeNull();
    expect(createRecord).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: form.removeResult }));
    await userEvent.click(screen.getByRole('button', { name: form.save }));
    expect(createRecord).toHaveBeenCalledOnce();
  });

  it('retains values and the client ID on retry', async () => {
    createRecord.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'r1', trustLevel: 'patient_entered' });
    mount();
    await userEvent.type(screen.getByRole('textbox', { name: form.title }), 'Kept title');
    await userEvent.click(screen.getByRole('button', { name: form.save }));
    expect(await screen.findByText(form.saveError)).not.toBeNull();
    expect((screen.getByRole('textbox', { name: form.title }) as HTMLInputElement).value).toBe('Kept title');
    await userEvent.click(screen.getByRole('button', { name: form.save }));
    expect(createRecord).toHaveBeenCalledTimes(2);
    expect(createRecord.mock.calls[0][0].clientId).toBe(createRecord.mock.calls[1][0].clientId);
  });
});

describe('editing a verified record', () => {
  it('warns before a clinical change and calls updateRecord', async () => {
    const before = makeRecord({ id: 'verified', title: 'Old title', trustLevel: 'clinician_verified' });
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><MemoryRouter><RecordForm initial={before} onSaved={vi.fn()} /></MemoryRouter></QueryClientProvider>);
    await userEvent.clear(screen.getByRole('textbox', { name: form.title }));
    await userEvent.type(screen.getByRole('textbox', { name: form.title }), 'New title');
    expect(screen.getByText(form.verificationWarning)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: form.save }));
    expect(updateRecord).toHaveBeenCalledWith(before, expect.objectContaining({ title: 'New title' }));
  });
});

it('retains all four scanned lab results when saving', async () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MemoryRouter><RecordForm initial={SAMPLES[1].candidates[0]} source="scan" resolveDocumentId={async () => 'doc-1'} onSaved={vi.fn()} /></MemoryRouter></QueryClientProvider>);
  expect(screen.getAllByRole('textbox', { name: form.resultName })).toHaveLength(4);
  await userEvent.click(screen.getByRole('button', { name: form.save }));
  await vi.waitFor(() => expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ source: 'scan', documentId: 'doc-1', details: expect.objectContaining({ results: expect.arrayContaining([expect.objectContaining({ name: 'HbA1c' }), expect.objectContaining({ name: 'Creatinine' })]) }) })));
  expect(createRecord.mock.calls.at(-1)?.[0].details.results).toHaveLength(4);
});
