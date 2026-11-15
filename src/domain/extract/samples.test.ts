/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SAMPLES } from './samples';

describe('SAMPLES', () => {
  it('contains exactly three samples with expected ids and image paths', () => {
    expect(SAMPLES).toHaveLength(3);
    const ids = SAMPLES.map((s) => s.id);
    expect(ids).toEqual(['prescription', 'lab-report', 'discharge']);
    expect(SAMPLES.map((s) => s.imagePath)).toEqual([
      '/samples/prescription.png',
      '/samples/lab-report.png',
      '/samples/discharge.png',
    ]);
  });

  it('has an existing image file under public/ for every sample', () => {
    for (const sample of SAMPLES) {
      const relativePath = sample.imagePath.replace(/^\//, '');
      const filePath = resolve(process.cwd(), 'public', relativePath);
      expect(existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
    }
  });

  it('prescription has 3 medication candidates with correct details', () => {
    const prescription = SAMPLES.find((s) => s.id === 'prescription');
    expect(prescription).toBeDefined();
    expect(prescription!.candidates).toHaveLength(3);
    expect(prescription!.candidates.map((c) => c.type)).toEqual([
      'medication',
      'medication',
      'medication',
    ]);
    expect(prescription!.candidates.map((c) => c.title)).toEqual([
      'Metformin',
      'Losartan',
      'Atorvastatin',
    ]);
    expect(prescription!.candidates.every((c) => c.occurredOn === '2026-11-14')).toBe(true);
    expect(
      prescription!.candidates.every((c) => c.providerName === 'San Rafael Medical Center'),
    ).toBe(true);

    expect(prescription!.candidates[0].details).toEqual({
      kind: 'medication',
      genericName: null,
      dose: '500 mg',
      frequency: 'twice daily',
      startOn: null,
      endOn: null,
    });
    expect(prescription!.candidates[1].details).toEqual({
      kind: 'medication',
      genericName: null,
      dose: '50 mg',
      frequency: 'once daily',
      startOn: null,
      endOn: null,
    });
    expect(prescription!.candidates[2].details).toEqual({
      kind: 'medication',
      genericName: null,
      dose: '20 mg',
      frequency: 'once daily at bedtime',
      startOn: null,
      endOn: null,
    });
  });

  it('lab report has 1 lab_result candidate with 4 results', () => {
    const labReport = SAMPLES.find((s) => s.id === 'lab-report');
    expect(labReport).toBeDefined();
    expect(labReport!.candidates).toHaveLength(1);
    const candidate = labReport!.candidates[0];
    expect(candidate.type).toBe('lab_result');
    expect(candidate.title).toBe('Blood chemistry');
    expect(candidate.occurredOn).toBe('2026-10-02');
    expect(candidate.providerName).toBe('Lakandula Diagnostics');
    expect(candidate.details).toEqual({
      kind: 'lab_result',
      results: [
        { name: 'HbA1c', value: '7.2', unit: '%', referenceRange: '4.0-5.6' },
        { name: 'Fasting blood sugar', value: '138', unit: 'mg/dL', referenceRange: '70-99' },
        { name: 'Total cholesterol', value: '212', unit: 'mg/dL', referenceRange: 'below 200' },
        { name: 'Creatinine', value: '0.9', unit: 'mg/dL', referenceRange: '0.6-1.1' },
      ],
    });
  });

  it('discharge has 1 diagnosis, 1 procedure, and 1 visit candidate', () => {
    const discharge = SAMPLES.find((s) => s.id === 'discharge');
    expect(discharge).toBeDefined();
    expect(discharge!.candidates).toHaveLength(3);
    expect(discharge!.candidates.map((c) => c.type)).toEqual([
      'diagnosis',
      'procedure',
      'visit',
    ]);
    expect(discharge!.candidates.every((c) => c.occurredOn === '2024-03-09')).toBe(true);
    expect(
      discharge!.candidates.every((c) => c.providerName === 'San Rafael Medical Center'),
    ).toBe(true);

    expect(discharge!.candidates[0]).toEqual({
      type: 'diagnosis',
      title: 'Cataract, right eye',
      occurredOn: '2024-03-09',
      providerName: 'San Rafael Medical Center',
      details: { kind: 'diagnosis' },
    });

    expect(discharge!.candidates[1]).toEqual({
      type: 'procedure',
      title: 'Cataract surgery, right eye',
      occurredOn: '2024-03-09',
      providerName: 'San Rafael Medical Center',
      details: { kind: 'procedure' },
    });

    expect(discharge!.candidates[2]).toEqual({
      type: 'visit',
      title: 'Hospital admission',
      occurredOn: '2024-03-09',
      providerName: 'San Rafael Medical Center',
      details: {
        kind: 'visit',
        reason: 'Cataract surgery, right eye',
        followUpOn: '2024-03-16',
      },
    });
  });
});
