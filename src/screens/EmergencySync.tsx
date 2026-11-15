import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProfile } from '../data/profile';
import { listRecords } from '../data/records';
import { buildEmergencyCard, clearEmergencyCard, saveEmergencyCard } from '../domain/emergency';

export function EmergencySync() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const records = useQuery({ queryKey: ['records'], queryFn: listRecords });
  useEffect(() => {
    if (!profile.data) return;
    if (!profile.data.emergencyConsent) clearEmergencyCard();
    else if (records.data) saveEmergencyCard(buildEmergencyCard(profile.data, records.data));
  }, [profile.data, records.data]);
  return null;
}
