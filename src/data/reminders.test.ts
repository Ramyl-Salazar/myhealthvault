import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn();

vi.mock('./supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./supabase')>()),
  supabase: { from: () => ({ upsert }) },
}));

import { dismissReminder } from './reminders';

beforeEach(() => {
  upsert.mockReset();
  upsert.mockResolvedValue({ data: null, error: null });
});

describe('dismissReminder', () => {
  it('ignores duplicates so a repeat dismissal changes nothing', async () => {
    await dismissReminder('dup:metformin');
    expect(upsert).toHaveBeenCalledWith(
      { reminder_key: 'dup:metformin' },
      { onConflict: 'user_id,reminder_key', ignoreDuplicates: true },
    );
  });
});
