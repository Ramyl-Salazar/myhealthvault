import { expect, it, vi } from 'vitest';
import { deleteEverything } from './deleteData';

const mocks = vi.hoisted(() => ({ order: [] as string[], list: vi.fn(async (..._args: unknown[]) => ({ data: [{ name: 'a.jpg' }], error: null })), remove: vi.fn(async (..._args: unknown[]) => ({ error: null })), rpc: vi.fn(async (..._args: unknown[]) => ({ error: null })), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock('./supabase', () => ({ currentUserId: async () => 'user-1', supabase: { storage: { from: () => ({ list: async (...args: unknown[]) => { mocks.order.push('list'); return mocks.list(...args); }, remove: async (...args: unknown[]) => { mocks.order.push('remove'); return mocks.remove(...args); } }) }, rpc: async (...args: unknown[]) => { mocks.order.push('rpc'); return mocks.rpc(...args); }, auth: { signOut: async () => { mocks.order.push('signOut'); return mocks.signOut(); } } } }));
vi.mock('./queryClient', () => ({ queryClient: { clear: vi.fn() } }));
vi.mock('../domain/emergency', () => ({ clearEmergencyCard: vi.fn() }));
vi.mock('../domain/pin', () => ({ clearPin: vi.fn() }));

it('removes files before deleting database rows, then signs out', async () => {
  mocks.order.length = 0;
  await deleteEverything();
  expect(mocks.remove).toHaveBeenCalledWith(['user-1/a.jpg']);
  expect(mocks.rpc).toHaveBeenCalledWith('delete_my_data');
  expect(mocks.order).toEqual(['list', 'remove', 'rpc', 'signOut']);
});
