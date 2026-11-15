import { check, supabase } from './supabase';

export async function dismissReminder(key: string): Promise<void> {
  check(
    await supabase.from('reminder_dismissals').upsert({ reminder_key: key }, { onConflict: 'user_id,reminder_key', ignoreDuplicates: true }),
    'Could not dismiss the reminder',
  );
}

export async function listDismissed(): Promise<Set<string>> {
  const rows = check(
    await supabase.from('reminder_dismissals').select('reminder_key'),
    'Could not load dismissed reminders',
  );
  return new Set((rows ?? []).map((row) => row.reminder_key as string));
}
