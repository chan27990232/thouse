import { supabase } from './supabase';

const BUCKET = 'property-verification';

function extFromName(filename: string, fallback: string) {
  const e = filename.split('.').pop();
  if (e && e.length <= 6) return e.toLowerCase();
  return fallback;
}

/** billMonth: YYYY-MM，會正規化為該月 1 日寫入 DB */
export function billMonthToDate(billMonth: string): string {
  const t = billMonth.trim();
  if (!/^\d{4}-\d{2}$/.test(t)) throw new Error('月份格式須為 YYYY-MM');
  return `${t}-01`;
}

/**
 * 上傳單一物業某月份水電煤單；若該月已有記錄會刪舊檔再覆寫列。
 */
export async function uploadPropertyUtilityBill(
  landlordId: string,
  propertyId: string,
  billMonth: string,
  file: File
): Promise<void> {
  if (!file.size) {
    throw new Error('請選擇檔案');
  }
  const maxBytes = 12 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('檔案請小於 12MB');
  }

  const monthDate = billMonthToDate(billMonth);
  const ymd = monthDate.slice(0, 7);

  const { data: existing, error: fetchErr } = await supabase
    .from('property_utility_bills')
    .select('id, storage_path')
    .eq('property_id', propertyId)
    .eq('bill_month', monthDate)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`讀取紀錄失敗：${fetchErr.message}`);
  }

  if (existing?.storage_path) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([existing.storage_path]);
    if (rmErr) {
      console.warn('[utility bills] remove old file', rmErr.message);
    }
  }

  const ext = extFromName(file.name, 'pdf');
  const path = `${landlordId}/${propertyId}/utilities/${ymd}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (upErr) {
    throw new Error(`上傳檔案失敗：${upErr.message}`);
  }

  const row = {
    property_id: propertyId,
    landlord_id: landlordId,
    bill_month: monthDate,
    storage_path: path,
    original_filename: file.name,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from('property_utility_bills')
      .update({
        storage_path: path,
        original_filename: file.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (updErr) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error(`儲存紀錄失敗：${updErr.message}`);
    }
  } else {
    const { error: insErr } = await supabase.from('property_utility_bills').insert(row);
    if (insErr) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error(`儲存紀錄失敗：${insErr.message}`);
    }
  }
}
