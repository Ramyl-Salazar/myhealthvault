import type { HealthRecord, Profile } from '../domain/types';

type Row = Record<string, unknown>;

const RECORD_COLUMNS: [keyof HealthRecord, string][] = [
  ['id', 'id'],
  ['userId', 'user_id'],
  ['type', 'type'],
  ['title', 'title'],
  ['occurredOn', 'occurred_on'],
  ['details', 'details'],
  ['providerName', 'provider_name'],
  ['notes', 'notes'],
  ['status', 'status'],
  ['trustLevel', 'trust_level'],
  ['documentId', 'document_id'],
  ['verifiedBy', 'verified_by'],
  ['verifiedLicense', 'verified_license'],
  ['verifiedAt', 'verified_at'],
  ['createdAt', 'created_at'],
  ['updatedAt', 'updated_at'],
];

const PROFILE_COLUMNS: [keyof Profile, string][] = [
  ['id', 'id'],
  ['displayName', 'display_name'],
  ['birthDate', 'birth_date'],
  ['sex', 'sex'],
  ['bloodType', 'blood_type'],
  ['emergencyContacts', 'emergency_contacts'],
  ['emergencyConsent', 'emergency_consent'],
];

function fromRow<T>(columns: [string, string][], row: Row): T {
  const out: Row = {};
  for (const [field, column] of columns) out[field] = row[column] ?? null;
  return out as T;
}

// Only keys present in the patch are written, so an absent key is never sent.
function toRow(columns: [string, string][], patch: Row): Row {
  const out: Row = {};
  for (const [field, column] of columns) {
    if (patch[field] !== undefined) out[column] = patch[field];
  }
  return out;
}

export function recordFromRow(row: Row): HealthRecord {
  return fromRow<HealthRecord>(RECORD_COLUMNS, row);
}

export function recordToRow(patch: Partial<HealthRecord>): Row {
  return toRow(RECORD_COLUMNS, patch);
}

export function profileFromRow(row: Row): Profile {
  const profile = fromRow<Profile>(PROFILE_COLUMNS, row);
  return { ...profile, emergencyContacts: profile.emergencyContacts ?? [], emergencyConsent: row.emergency_consent === true };
}

export function profileToRow(patch: Partial<Profile>): Row {
  const { id: _id, ...rest } = patch;
  return toRow(PROFILE_COLUMNS, rest);
}
