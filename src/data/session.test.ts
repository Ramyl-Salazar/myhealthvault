import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, rpc, maybeSingle } = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), getUser: vi.fn(), signInAnonymously: vi.fn(), signOut: vi.fn() },
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('./supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./supabase')>()),
  supabase: {
    auth,
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

import { startDemo } from './session';

const user = { data: { user: { id: 'u1' } }, error: null };

beforeEach(() => {
  vi.resetAllMocks();
  auth.signOut.mockResolvedValue({ error: null });
  auth.signInAnonymously.mockResolvedValue({ data: {}, error: null });
  rpc.mockResolvedValue({ error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('startDemo', () => {
  it('signs in and seeds for a new visitor', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.getUser.mockResolvedValue(user);
    await startDemo();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('seed_demo_data');
  });

  it('does nothing more for a valid session with a profile', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'a' } }, error: null });
    auth.getUser.mockResolvedValue(user);
    maybeSingle.mockResolvedValue({ data: { id: 'u1' }, error: null });
    await startDemo();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('recovers when the stored session belongs to a deleted account', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'old' } }, error: null });
    auth.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'User from sub claim in JWT does not exist' } })
      .mockResolvedValue(user);
    await startDemo();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects with a clear message when anonymous sign-in fails', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.signInAnonymously.mockResolvedValue({ data: {}, error: { message: 'disabled' } });
    await expect(startDemo()).rejects.toThrow('Could not start the demo: disabled');
  });

  it('shares one in-flight call, then starts fresh', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.getUser.mockResolvedValue(user);
    const first = startDemo();
    const second = startDemo();
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    await startDemo();
    expect(auth.getSession).toHaveBeenCalledTimes(2);
  });
});
