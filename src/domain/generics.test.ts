import { describe, expect, it } from 'vitest';
import { toGeneric } from './generics';

describe('toGeneric', () => {
  it('strips dose and form, then maps a known brand', () => {
    expect(toGeneric('Glucophage 500 mg tablet')).toBe('metformin');
  });
  it('lower-cases a generic name', () => {
    expect(toGeneric('METFORMIN')).toBe('metformin');
  });
  it('maps the required brands', () => {
    expect(toGeneric('Biogesic')).toBe('paracetamol');
    expect(toGeneric('Lifezar 50mg')).toBe('losartan');
    expect(toGeneric('Norvasc 5 mg tab')).toBe('amlodipine');
    expect(toGeneric('Ventolin syrup')).toBe('salbutamol');
    expect(toGeneric('Neobloc 50 mg')).toBe('metoprolol');
  });
  it('returns the cleaned lower-case name for an unknown name', () => {
    expect(toGeneric('Somethingelse 10 mg capsule')).toBe('somethingelse');
  });
  it('handles decimals, mcg and surrounding whitespace', () => {
    expect(toGeneric('  Levothyroxine 0.05 mcg  ')).toBe('levothyroxine');
    expect(toGeneric('Amoxicillin 500mg capsules')).toBe('amoxicillin');
  });
  it('returns an empty string for an empty name', () => {
    expect(toGeneric('')).toBe('');
  });
});
