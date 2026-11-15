import { beforeEach, expect, it, vi } from 'vitest';
import { deleteEverything } from './deleteData';

const mocks = vi.hoisted(() => ({ order: [] as string[], list: vi.fn(async (..._args: unknown[]) => ({ data: [{ name: 'a.jpg' }], error: null })), remove: vi.fn(async (..._args: unknown[]) => ({ error: null as { message: string } | null })), rpc: vi.fn(async (..._args: unknown[]) => ({ error: null as { message: string } | null })), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock('./supabase', () => ({ currentUserId: async () => 'user-1', supabase: { storage: { from: () => ({ list: async (...args: unknown[]) => { mocks.order.push('list'); return mocks.list(...args); }, remove: async (...args: unknown[]) => { mocks.order.push('remove'); return mocks.remove(...args); } }) }, rpc: async (...args: unknown[]) => { mocks.order.push('rpc'); return mocks.rpc(...args); }, auth: { signOut: async () => { mocks.order.push('signOut'); return mocks.signOut(); } } } }));
vi.mock('./queryClient', () => ({ queryClient: { clear: vi.fn() }, persister: { removeClient: vi.fn(async () => { localStorage.removeItem('mhv-query-cache'); }) } }));
vi.mock('../domain/emergency', () => ({ clearEmergencyCard: vi.fn() }));
vi.mock('../domain/pin', () => ({ clearPin: vi.fn() }));

beforeEach(() => { mocks.order.length = 0; vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });

it('deletes database rows before removing files, then clears both caches and signs out', async () => {
  localStorage.setItem('mhv-query-cache', 'cached');
  sessionStorage.setItem('share-url:one', 'secret');
  sessionStorage.setItem('other', 'keep');
  await deleteEverything();
  expect(mocks.remove).toHaveBeenCalledWith(['user-1/a.jpg']);
  expect(mocks.rpc).toHaveBeenCalledWith('delete_my_data');
  expect(mocks.order).toEqual(['list', 'rpc', 'remove', 'signOut']);
  expect(localStorage.getItem('mhv-query-cache')).toBeNull();
  expect(sessionStorage.getItem('share-url:one')).toBeNull();
  expect(sessionStorage.getItem('other')).toBe('keep');
});

it('leaves files and device data intact when database deletion fails', async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { message: 'failed' } });
  localStorage.setItem('mhv-query-cache', 'cached');
  await expect(deleteEverything()).rejects.toThrow('failed');
  expect(mocks.order).toEqual(['list', 'rpc']);
  expect(localStorage.getItem('mhv-query-cache')).toBe('cached');
});

it('finishes device cleanup and sign-out when file removal fails', async () => {
  mocks.remove.mockResolvedValueOnce({ error: { message: 'failed' } });
  localStorage.setItem('mhv-query-cache', 'cached');
  await expect(deleteEverything()).resolves.toBeUndefined();
  expect(mocks.order).toEqual(['list', 'rpc', 'remove', 'signOut']);
  expect(localStorage.getItem('mhv-query-cache')).toBeNull();
});
