import { expect, it } from 'vitest';
import { ageYears } from './age';

it('calculates age at the birthday boundary and omits missing dates', () => {
  expect(ageYears('1968-03-12', new Date('2026-03-11T12:00:00Z'))).toBe(57);
  expect(ageYears('1968-03-12', new Date('2026-03-12T12:00:00Z'))).toBe(58);
  expect(ageYears(null, new Date())).toBeNull();
});
