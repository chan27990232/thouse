import { supabase } from './supabase';

/** 與租盤主圖同一 bucket（公開讀），路徑帶租客 user id */
const BUCKET = 'property-listing-images';

function extFromFile(file: File) {
  const n = file.name.split('.').pop();
  if (n && n.length <= 6) return n.toLowerCase();
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
}

export async function uploadBankTransferReceipt(tenantUserId: string, file: File): Promise<string> {
  const ext = extFromFile(file);
  const path = `${tenantUserId}/lease-bank-receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) {
    const m = (error.message || '').toLowerCase();
    let hint = '';
    if (m.includes('not found') || m.includes('bucket')) {
      hint = '請在 Supabase Storage 建立 property-listing-images（Public），或執行 npm run db:storage-buckets。';
    } else if (m.includes('row-level security') || m.includes('rls')) {
      hint = '請確認 Storage policy 允許租客上傳到自己的路徑。';
    }
    throw new Error(`上傳轉賬證明失敗：${error.message} ${hint}`.trim());
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
