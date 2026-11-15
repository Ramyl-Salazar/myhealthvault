import type { HealthRecord, Profile } from './types';
import { safeStorage } from './storage';

export interface EmergencyCard {
  name: string;
  bloodType: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  contacts: Profile['emergencyContacts'];
  savedAt: string;
}

const key = 'mhv.emergency.v1';
export function buildEmergencyCard(profile: Profile, records: HealthRecord[]): EmergencyCard {
  const active = records.filter(record => record.status === 'active');
  return {
    name: profile.displayName,
    bloodType: profile.bloodType,
    allergies: active.filter(record => record.type === 'allergy').map(record => record.title),
    conditions: active.filter(record => record.type === 'diagnosis').map(record => record.title),
    medications: active.filter(record => record.type === 'medication').map(record => record.title),
    contacts: profile.emergencyContacts,
    savedAt: new Date().toISOString(),
  };
}
export function saveEmergencyCard(card: EmergencyCard): boolean { return safeStorage.set(key, JSON.stringify(card)); }
export function loadEmergencyCard(): EmergencyCard | null {
  const value = safeStorage.get(key);
  if (!value) return null;
  try {
    const card = JSON.parse(value) as EmergencyCard;
    return typeof card.name === 'string' && Array.isArray(card.allergies) && Array.isArray(card.contacts) ? card : null;
  } catch { return null; }
}
export function clearEmergencyCard(): void { safeStorage.remove(key); }
