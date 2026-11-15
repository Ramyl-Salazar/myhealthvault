import { expect, it, vi } from 'vitest';
import { makeRecord } from '../domain/testing';
import { exportAll } from './exportData';

vi.mock('./profile', () => ({ getProfile: vi.fn(async () => ({ displayName: 'Demo patient' })) }));
vi.mock('./records', () => ({ listRecords: vi.fn(async () => [makeRecord({ title: 'Penicillin' }), makeRecord({ title: 'Diabetes' })]) }));
vi.mock('./shares', () => ({ listShares: vi.fn(async () => [{ id: 's1' }]), getShareLog: vi.fn(async () => [{ id: 'l1' }]) }));
vi.mock('./supabase', () => ({ supabase: { from: () => ({ select: () => ({ order: async () => ({ data: [{ id: 'd1' }], error: null }) }) }) }, check: (result: { data: unknown }) => result.data }));

it('exports all records, document rows, shares and access logs as JSON', async () => {
  const result = JSON.parse(await (await exportAll()).text());
  expect(result.records).toHaveLength(2);
  expect(result.documents).toEqual([{ id: 'd1' }]);
  expect(result.shares).toEqual([{ id: 's1' }]);
  expect(result.accessLog).toEqual([{ id: 'l1' }]);
  expect(JSON.stringify(result)).not.toContain('token_hash');
});
