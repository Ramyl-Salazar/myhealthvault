import { beforeEach, expect, it, vi } from 'vitest';
import { makeRecord } from './testing';
import type { Profile } from './types';
import { buildEmergencyCard, loadEmergencyCard } from './emergency';

const profile: Profile = { id: 'p', displayName: 'Lourdes Villareal', birthDate: null, sex: null, bloodType: 'O+', emergencyContacts: [], emergencyConsent: true };
beforeEach(() => localStorage.clear());

it('builds an active-only card with allergies, conditions and medicines', () => {
  const records = [
    makeRecord({ type: 'allergy', title: 'Penicillin', status: 'active' }),
    makeRecord({ type: 'diagnosis', title: 'Type 2 diabetes', status: 'active' }),
    makeRecord({ type: 'diagnosis', title: 'Hypertension', status: 'active' }),
    makeRecord({ type: 'medication', title: 'Metformin', status: 'active' }),
    makeRecord({ type: 'medication', title: 'Old medicine', status: 'resolved' }),
  ];
  const card = buildEmergencyCard(profile, records);
  expect(card.allergies.join(' ')).toContain('Penicillin');
  expect(card.conditions).toEqual(['Type 2 diabetes', 'Hypertension']);
  expect(card.medications.join(' ')).toContain('Metformin');
  expect(card.medications.join(' ')).not.toContain('Old medicine');
});

it('returns null when device storage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(loadEmergencyCard()).toBeNull();
  vi.restoreAllMocks();
});
