const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a YYYY-MM-DD string into its parts. Returns null for anything that is
 * not a real calendar date. Works on the string parts, never on local time.
 */
export function parseIsoDate(iso: string | null | undefined): { year: number; month: number; day: number } | null {
  if (typeof iso !== 'string') return null;
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** Whole days since 1970-01-01 (UTC) for a YYYY-MM-DD string, or null if invalid. */
export function dayNumber(iso: string | null | undefined): number | null {
  const parts = parseIsoDate(iso);
  if (!parts) return null;
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

export function formatDate(iso: string | null): string {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}
