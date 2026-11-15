import type { CandidateRecord } from '../types';

export type SampleId = 'prescription' | 'lab-report' | 'discharge';

export interface SampleDocument {
  id: SampleId;
  imagePath: string;
  candidates: CandidateRecord[];
}

export const SAMPLES: SampleDocument[] = [
  {
    id: 'prescription',
    imagePath: '/samples/prescription.png',
    candidates: [
      {
        type: 'medication',
        title: 'Metformin',
        occurredOn: '2026-11-14',
        providerName: 'San Rafael Medical Center',
        details: {
          kind: 'medication',
          genericName: null,
          dose: '500 mg',
          frequency: 'twice daily',
          startOn: null,
          endOn: null,
        },
      },
      {
        type: 'medication',
        title: 'Losartan',
        occurredOn: '2026-11-14',
        providerName: 'San Rafael Medical Center',
        details: {
          kind: 'medication',
          genericName: null,
          dose: '50 mg',
          frequency: 'once daily',
          startOn: null,
          endOn: null,
        },
      },
      {
        type: 'medication',
        title: 'Atorvastatin',
        occurredOn: '2026-11-14',
        providerName: 'San Rafael Medical Center',
        details: {
          kind: 'medication',
          genericName: null,
          dose: '20 mg',
          frequency: 'once daily at bedtime',
          startOn: null,
          endOn: null,
        },
      },
    ],
  },
  {
    id: 'lab-report',
    imagePath: '/samples/lab-report.png',
    candidates: [
      {
        type: 'lab_result',
        title: 'Blood chemistry',
        occurredOn: '2026-10-02',
        providerName: 'Lakandula Diagnostics',
        details: {
          kind: 'lab_result',
          results: [
            {
              name: 'HbA1c',
              value: '7.2',
              unit: '%',
              referenceRange: '4.0-5.6',
            },
            {
              name: 'Fasting blood sugar',
              value: '138',
              unit: 'mg/dL',
              referenceRange: '70-99',
            },
            {
              name: 'Total cholesterol',
              value: '212',
              unit: 'mg/dL',
              referenceRange: 'below 200',
            },
            {
              name: 'Creatinine',
              value: '0.9',
              unit: 'mg/dL',
              referenceRange: '0.6-1.1',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'discharge',
    imagePath: '/samples/discharge.png',
    candidates: [
      {
        type: 'diagnosis',
        title: 'Cataract, right eye',
        occurredOn: '2024-03-09',
        providerName: 'San Rafael Medical Center',
        details: {
          kind: 'diagnosis',
        },
      },
      {
        type: 'procedure',
        title: 'Cataract surgery, right eye',
        occurredOn: '2024-03-09',
        providerName: 'San Rafael Medical Center',
        details: {
          kind: 'procedure',
        },
      },
      {
        type: 'visit',
        title: 'Hospital admission',
        occurredOn: '2024-03-09',
        providerName: 'San Rafael Medical Center',
        details: {
          kind: 'visit',
          reason: 'Cataract surgery, right eye',
          followUpOn: '2024-03-16',
        },
      },
    ],
  },
];
