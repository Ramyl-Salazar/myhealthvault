export type RecordType = 'diagnosis' | 'allergy' | 'medication' | 'lab_result' | 'immunization' | 'procedure' | 'visit';
export type TrustLevel = 'patient_entered' | 'document_supported' | 'clinician_verified';
export type RecordStatus = 'active' | 'resolved';

export type RecordDetails =
  | { kind: 'diagnosis' }
  | { kind: 'procedure' }
  | { kind: 'allergy'; reaction: string | null; severity: 'mild' | 'moderate' | 'severe' | null }
  | { kind: 'medication'; genericName: string | null; dose: string | null; frequency: string | null; startOn: string | null; endOn: string | null }
  | { kind: 'lab_result'; results: { name: string; value: string; unit: string | null; referenceRange: string | null }[] }
  | { kind: 'immunization'; doseNumber: string | null }
  | { kind: 'visit'; reason: string | null; followUpOn: string | null };

export interface HealthRecord {
  id: string;
  userId: string;
  type: RecordType;
  title: string;
  occurredOn: string | null;
  details: RecordDetails;
  providerName: string | null;
  notes: string | null;
  status: RecordStatus;
  trustLevel: TrustLevel;
  documentId: string | null;
  verifiedBy: string | null;
  verifiedLicense: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateRecord {
  type: RecordType;
  title: string;
  occurredOn: string | null;
  details: RecordDetails;
  providerName: string | null;
}

export interface Profile {
  id: string;
  displayName: string;
  birthDate: string | null;
  sex: string | null;
  bloodType: string | null;
  emergencyContacts: { name: string; relation: string; phone: string }[];
  emergencyConsent: boolean;
}

export interface Reminder {
  key: string;
  kind: 'follow_up' | 'prescription_ending' | 'possible_duplicate';
  recordIds: string[];
  dueOn: string | null;
}

export interface Summary {
  conditions: HealthRecord[];
  allergies: HealthRecord[];
  medications: HealthRecord[];
  recentLabs: HealthRecord[];
  lastVisits: HealthRecord[];
}
