import { describe, expect, it } from 'vitest';
import { formatDate } from './dates';

describe('formatDate', () => {
  it('formats YYYY-MM-DD as day, short month, year', () => {
    expect(formatDate('2026-11-14')).toBe('14 Nov 2026');
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });
  it('returns an empty string for null or invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
    expect(formatDate('')).toBe('');
  });
  it('returns an empty string for impossible dates', () => {
    expect(formatDate('2026-02-31')).toBe('');
    expect(formatDate('2026-13-01')).toBe('');
    expect(formatDate('2026-00-10')).toBe('');
  });
  it('accepts a leap day only in a leap year', () => {
    expect(formatDate('2028-02-29')).toBe('29 Feb 2028');
    expect(formatDate('2026-02-29')).toBe('');
  });
});
