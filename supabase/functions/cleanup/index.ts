// Edge Function entry (Deno). Wires the handler to Supabase Auth, Storage and the
// profiles table with the service role; the logic and its tests are in handler.ts and
// index.test.ts. Deployed with verify_jwt = false: the caller is a GitHub Actions job
// with no session, and x-cleanup-secret is the only key. Contract: docs/contracts/cleanup.md.
import { adminClient, rows } from '../_shared/db.ts';
import { createHandler } from './handler.ts';

const admin = adminClient();
const bucket = admin.storage.from('documents');

const handler = createHandler({
  secret: Deno.env.get('CLEANUP_SECRET'),
  now: () => new Date(),

  async listUsers(page, perPage) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('list users failed');
    return data.users.map(user => ({
      id: user.id,
      isAnonymous: user.is_anonymous === true,
      createdAt: user.created_at,
    }));
  },

  async keepFlags(ids) {
    const data = rows<{ id: string; keep: boolean }[]>(await admin.from('profiles').select('id, keep').in('id', ids));
    return new Map(data.map(row => [row.id, row.keep]));
  },

  async listFolder(folder, offset, limit) {
    const { data, error } = await bucket.list(folder, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error('list files failed');
    // The Storage API marks a folder with a null id.
    return data.map(entry => ({ name: entry.name, isFolder: entry.id === null }));
  },

  async removeFiles(paths) {
    const { error } = await bucket.remove(paths);
    if (error) throw new Error('remove files failed');
  },

  async deleteUser(id) {
    // A hard delete. profiles, records, documents, shares (with share_access_log) and
    // reminder_dismissals reference auth.users on delete cascade.
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error('delete user failed');
  },

  log: message => console.log(message),
});

Deno.serve(handler);
