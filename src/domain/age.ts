import { parseIsoDate } from './dates';

export function ageYears(birthDate: string | null, now: Date): number | null {
  const birth = parseIsoDate(birthDate);
  if (!birth || !Number.isFinite(now.getTime())) return null;
  const year = now.getUTCFullYear();
  const age = year - birth.year - (now.getUTCMonth() + 1 < birth.month || (now.getUTCMonth() + 1 === birth.month && now.getUTCDate() < birth.day) ? 1 : 0);
  return age >= 0 ? age : null;
}
