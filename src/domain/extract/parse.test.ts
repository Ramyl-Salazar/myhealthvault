import { describe, expect, it } from 'vitest';
import { needsHelp, parseDocumentText } from './parse';
import prescriptionOcr from '../../../tests/fixtures/ocr/prescription.txt?raw';
import labOcr from '../../../tests/fixtures/ocr/lab-report.txt?raw';
import dischargeOcr from '../../../tests/fixtures/ocr/discharge.txt?raw';

describe('document parsing', () => {
  it('reads medication names, doses, and frequency without inventing missing doses', () => {
    const records = parseDocumentText('San Rafael Medical Center\nDate: 14 Nov 2026\nMetformin 500 mg twice daily\nLosartan 50 mg once daily\nAtorvastatin 20 mg once daily at bedtime');
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ type: 'medication', title: 'Metformin', occurredOn: '2026-11-14', details: { dose: '500 mg', frequency: 'twice daily' } });
    expect(parseDocumentText('Losartan tablet once daily')[0].details).toMatchObject({ dose: null });
  });

  it('groups lab lines in one candidate', () => {
    const records = parseDocumentText('Lakandula Diagnostics\nOctober 2, 2026\nBlood chemistry\nHbA1c 7.2 % 4.0-5.6\nFasting blood sugar 138 mg/dL 70-99');
    expect(records).toHaveLength(1);
    expect(records[0].details).toMatchObject({ kind: 'lab_result', results: expect.arrayContaining([{ name: 'HbA1c', value: '7.2', unit: '%', referenceRange: '4.0-5.6' }]) });
  });

  it('drops noise and requests help for weak reads', () => {
    expect(parseDocumentText('')).toEqual([]);
    expect(parseDocumentText('asdf ;;; 123 ###')).toEqual([]);
    const candidate = parseDocumentText('Losartan tablet once daily')[0];
    expect(needsHelp({ confidence: 91 }, [])).toBe(true);
    expect(needsHelp({ confidence: 40 }, [candidate])).toBe(true);
    expect(needsHelp({ confidence: 91 }, [candidate])).toBe(false);
  });

  it('parses the actual sample OCR, including wrapped DOB and Sig lines', () => {
    const medications = parseDocumentText(prescriptionOcr);
    expect(medications.map(record => record.title)).toEqual(['Metformin', 'Losartan', 'Atorvastatin']);
    expect(medications[2].details).toMatchObject({ frequency: 'once daily at bedtime' });
    const labs = parseDocumentText(labOcr);
    expect(labs).toHaveLength(1);
    expect(labs[0].details).toMatchObject({ kind: 'lab_result', results: expect.any(Array) });
    if (labs[0].details.kind === 'lab_result') expect(labs[0].details.results).toHaveLength(4);
    expect(parseDocumentText(dischargeOcr).map(record => record.type)).toEqual(['diagnosis', 'procedure', 'visit']);
  });
});
