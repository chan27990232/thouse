import { supabase } from './supabase';

const BUCKET_LISTING = 'property-listing-images';
const BUCKET_VERIFICATION = 'property-verification';

function extFromName(filename: string, fallback: string) {
  const e = filename.split('.').pop();
  if (e && e.length <= 6) return e.toLowerCase();
  return fallback;
}

/** 租盤主圖（公開 URL）— 檔案存於業主資料夾 */
export async function uploadListingCoverImage(landlordId: string, file: File): Promise<string> {
  const ext = extFromName(file.name, 'jpg');
  const path = `${landlordId}/cover-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_LISTING).upload(path, file, { upsert: false });
  if (error) {
    throw new Error(`上傳租盤主圖失敗：${error.message}`);
  }
  const { data } = supabase.storage.from(BUCKET_LISTING).getPublicUrl(path);
  return data.publicUrl;
}

/** 實景佐證 — 回傳 storage path */
export async function uploadProofPhotoFiles(landlordId: string, files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = extFromName(f.name, 'jpg');
    const path = `${landlordId}/proof-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_VERIFICATION).upload(path, f, { upsert: false });
    if (error) {
      throw new Error(`上傳佐證照片失敗：${error.message}`);
    }
    out.push(path);
  }
  return out;
}

/** 房產證明 — 回傳 storage path */
export async function uploadDeedFile(landlordId: string, file: File): Promise<string> {
  const ext = extFromName(file.name, 'pdf');
  const path = `${landlordId}/deed-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_VERIFICATION).upload(path, file, { upsert: false });
  if (error) {
    throw new Error(`上傳房產證明失敗：${error.message}`);
  }
  return path;
}

export async function signedUrlForVerificationPath(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_VERIFICATION)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
