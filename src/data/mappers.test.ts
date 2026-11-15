import { describe, expect, it } from 'vitest';
import { makeRecord } from '../domain/testing';
import { profileFromRow, profileToRow, recordFromRow, recordToRow } from './mappers';

const row = {
  id: 'r1',
  user_id: 'u1',
  type: 'medication',
  title: 'Metformin',
  occurred_on: '2026-01-02',
  details: { kind: 'medication', genericName: 'Metformin', dose: '500 mg', frequency: 'twice daily', startOn: null, endOn: null },
  provider_name: 'Dr. Cruz',
  notes: null,
  status: 'active',
  trust_level: 'clinician_verified',
  document_id: null,
  verified_by: 'Dr. Cruz',
  verified_license: '0098765',
  verified_at: '2026-01-03T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-04T00:00:00Z',
};

describe('recordFromRow', () => {
  it('maps snake_case columns to the domain record', () => {
    const record = recordFromRow(row);
    expect(record.userId).toBe('u1');
    expect(record.occurredOn).toBe('2026-01-02');
    expect(record.providerName).toBe('Dr. Cruz');
    expect(record.trustLevel).toBe('clinician_verified');
    expect(record.verifiedLicense).toBe('0098765');
    expect(record.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(record.details).toEqual(row.details);
  });
});

describe('recordToRow', () => {
  it('maps a domain record back to columns and round-trips', () => {
    expect(recordToRow(recordFromRow(row))).toEqual(row);
  });

  it('leaves out fields that are not in the patch', () => {
    expect(recordToRow({ notes: 'x' })).toEqual({ notes: 'x' });
  });

  it('keeps explicit nulls', () => {
    expect(recordToRow({ providerName: null })).toEqual({ provider_name: null });
  });

  it('round-trips a record made by the test helper', () => {
    const record = makeRecord({ title: 'Asthma' });
    expect(recordFromRow(recordToRow(record))).toEqual(record);
  });
});

describe('profile mapping', () => {
  const profileRow = {
    id: 'u1',
    display_name: 'Lourdes Villareal',
    birth_date: '1968-03-12',
    sex: 'female',
    blood_type: 'O+',
    emergency_contacts: [{ name: 'Ramon', relation: 'Husband', phone: '0917 555 0142' }],
    emergency_consent: true,
    keep: false,
    gemini_reads: 3,
    created_at: '2026-01-01T00:00:00Z',
  };

  it('maps a row to a profile and ignores server-only columns', () => {
    expect(profileFromRow(profileRow)).toEqual({
      id: 'u1',
      displayName: 'Lourdes Villareal',
      birthDate: '1968-03-12',
      sex: 'female',
      bloodType: 'O+',
      emergencyContacts: [{ name: 'Ramon', relation: 'Husband', phone: '0917 555 0142' }],
      emergencyConsent: true,
    });
  });

  it('maps a patch to columns without the id', () => {
    expect(profileToRow({ displayName: 'A', emergencyConsent: false, id: 'zzz' })).toEqual({
      display_name: 'A',
      emergency_consent: false,
    });
  });
});
