import { describe, expect, it } from 'vitest';
import { trustAfterEdit, trustForNew } from './trust';
import { makeRecord } from './testing';

const verified = makeRecord({
  title: 'Hypertension',
  trustLevel: 'clinician_verified',
  verifiedBy: 'Dr. Example',
  verifiedLicense: '0000000',
  verifiedAt: '2026-02-01T00:00:00Z',
});

describe('trustForNew', () => {
  it('marks manual entries patient_entered and scans document_supported', () => {
    expect(trustForNew('manual')).toBe('patient_entered');
    expect(trustForNew('scan')).toBe('document_supported');
  });
});

describe('trustAfterEdit', () => {
  it('drops to patient_entered when the title changes', () => {
    expect(trustAfterEdit(verified, { ...verified, title: 'changed' })).toBe('patient_entered');
  });
  it('drops to patient_entered when the date, details or status change', () => {
    expect(trustAfterEdit(verified, { ...verified, occurredOn: '2026-03-03' })).toBe('patient_entered');
    expect(trustAfterEdit(verified, { ...verified, status: 'resolved' })).toBe('patient_entered');
    expect(trustAfterEdit(verified, { ...verified, details: { kind: 'procedure' } })).toBe('patient_entered');
  });
  it('keeps the level when only provider or notes changed', () => {
    expect(trustAfterEdit(verified, verified)).toBe('clinician_verified');
  });
  it('keeps document_supported when nothing material changed', () => {
    const doc = makeRecord({ trustLevel: 'document_supported' });
    expect(trustAfterEdit(doc, doc)).toBe('document_supported');
  });
  it('drops document_supported to patient_entered on a material change', () => {
    const doc = makeRecord({ trustLevel: 'document_supported' });
    expect(trustAfterEdit(doc, { ...doc, title: 'other' })).toBe('patient_entered');
  });
  it('treats equal nested details as unchanged', () => {
    const lab = makeRecord({
      type: 'lab_result',
      trustLevel: 'clinician_verified',
      details: { kind: 'lab_result', results: [{ name: 'HbA1c', value: '6.1', unit: '%', referenceRange: null }] },
    });
    const copy = { ...lab, details: JSON.parse(JSON.stringify(lab.details)) };
    expect(trustAfterEdit(lab, copy)).toBe('clinician_verified');
  });
});
