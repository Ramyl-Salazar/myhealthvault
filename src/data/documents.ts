import { check, currentUserId, supabase } from './supabase';

const BUCKET = 'documents';
const SIGNED_URL_SECONDS = 600;

export async function uploadDocument(file: Blob, kind: string): Promise<{ id: string; storagePath: string }> {
  const userId = await currentUserId();
  const id = crypto.randomUUID();
  const storagePath = `${userId}/${id}.jpg`;

  const upload = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: 'image/jpeg' });
  if (upload.error) throw new Error(`Could not upload the document: ${upload.error.message}`);

  check(
    await supabase.from('documents').insert({ id, user_id: userId, storage_path: storagePath, kind }),
    'Could not save the document',
  );
  return { id, storagePath };
}

export async function documentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (error || !data) throw new Error(`Could not open the document: ${error?.message ?? 'no link'}`);
  return data.signedUrl;
}
