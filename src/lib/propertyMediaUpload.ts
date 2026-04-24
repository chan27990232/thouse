import { supabase } from './supabase';

const BUCKET_LISTING = 'property-listing-images';
const BUCKET_VERIFICATION = 'property-verification';

function extFromName(filename: string, fallback: string) {
  const e = filename.split('.').pop();
  if (e && e.length <= 6) return e.toLowerCase();
  return fallback;
}

/**
 * 租盤主圖：公開讀、寫入僅能 userId/ 下
 */
export async function uploadListingCoverImage(userId: string, file: File): Promise<string> {
  const ext = extFromName(file.name, 'jpg');
  const path = `${userId}/cover-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_LISTING).upload(path, file, { upsert: false });
  if (error) {
    const m = (error.message || '').toLowerCase();
    let hint = '';
    if (m.includes('not found') || m.includes('bucket')) {
      hint =
        ' 若提示 Bucket 不存在，請執行：npm run db:storage-buckets，或在 Storage 手動建立 property-listing-images（Public）。';
    } else if (m.includes('row-level security') || m.includes('rls')) {
      hint = ' 若是 RLS 權限，請執行：npm run db:fix-storage-rls（或套用 supabase/fix_property_storage_rls.sql）。';
    }
    throw new Error(
      `上傳租盤主圖失敗：${error.message}。${hint}`
    );
  }
  const { data } = supabase.storage.from(BUCKET_LISTING).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * 實景佐證：寫入 property-verification bucket，DB 只存相對路徑
 */
export async function uploadProofPhotoFiles(userId: string, files: File[]): Promise<string[]> {
  if (files.length < 1) {
    throw new Error('至少上傳一張實景佐證照片');
  }
  const out: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = extFromName(f.name, 'jpg');
    const path = `${userId}/proof-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_VERIFICATION).upload(path, f, { upsert: false });
    if (error) {
      throw new Error(
        `上傳佐證照片失敗：${error.message}。請確認已建立 bucket「property-verification」且已套用 storage 政策。`
      );
    }
    out.push(path);
  }
  return out;
}

/**
 * 房產證明（圖或 PDF）
 */
export async function uploadDeedFile(userId: string, file: File): Promise<string> {
  const ext = extFromName(file.name, 'pdf');
  const path = `${userId}/deed-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_VERIFICATION).upload(path, file, { upsert: false });
  if (error) {
    throw new Error(`上傳房產證明失敗：${error.message}`);
  }
  return path;
}
