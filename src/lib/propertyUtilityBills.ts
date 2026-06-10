import { supabase } from './supabase';

const BUCKET = 'property-verification';

export const UTILITY_BILL_MAX_FILES = 10;
export const UTILITY_BILL_MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export type UtilityBillType = 'water' | 'electricity' | 'gas';

export const UTILITY_BILL_TYPE_OPTIONS: { value: UtilityBillType; label: string; hint: string }[] = [
  { value: 'water', label: '水費', hint: '水務署或管理處水費單' },
  { value: 'electricity', label: '電費', hint: '中電／港燈等電費單' },
  { value: 'gas', label: '煤氣費', hint: '煤氣公司帳單' },
];

export function utilityBillTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'water':
      return '水費';
    case 'electricity':
      return '電費';
    case 'gas':
      return '煤氣費';
    default:
      return '—';
  }
}

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

export function validateUtilityBillFiles(files: File[], existingCount = 0): string | null {
  if (files.length === 0) return '請選擇至少一個檔案';
  if (files.length > UTILITY_BILL_MAX_FILES) {
    return `每次最多上傳 ${UTILITY_BILL_MAX_FILES} 個檔案`;
  }
  if (existingCount + files.length > UTILITY_BILL_MAX_FILES) {
    return `此月份已有 ${existingCount} 個檔案，最多共 ${UTILITY_BILL_MAX_FILES} 個`;
  }
  let total = 0;
  for (const f of files) {
    if (!f.size) return '檔案不能為空';
    total += f.size;
  }
  if (total > UTILITY_BILL_MAX_TOTAL_BYTES) {
    return '所選檔案總大小請在 500MB 以內';
  }
  return null;
}

/**
 * 上傳單一物業某月份水電煤單（可一次多檔，每月累計最多 10 檔、總計 500MB 以內）。
 */
export async function uploadPropertyUtilityBills(
  landlordId: string,
  propertyId: string,
  billMonth: string,
  billType: UtilityBillType,
  files: File[],
  tenantPayableHkd: number
): Promise<number> {
  const monthDate = billMonthToDate(billMonth);
  const ymd = monthDate.slice(0, 7);

  const { data: existingRows, error: fetchErr } = await supabase
    .from('property_utility_bills')
    .select('id')
    .eq('property_id', propertyId)
    .eq('bill_month', monthDate);

  if (fetchErr) {
    throw new Error(`讀取紀錄失敗：${fetchErr.message}`);
  }

  const existingCount = existingRows?.length ?? 0;
  const validationErr = validateUtilityBillFiles(files, existingCount);
  if (validationErr) throw new Error(validationErr);

  if (!Number.isFinite(tenantPayableHkd) || tenantPayableHkd <= 0) {
    throw new Error('應付水電煤請填寫大於 0 的金額');
  }
  const payable = Math.round(tenantPayableHkd * 100) / 100;

  const uploadedPaths: string[] = [];
  const rows: {
    property_id: string;
    landlord_id: string;
    bill_month: string;
    storage_path: string;
    original_filename: string;
    tenant_payable_hkd: number;
    bill_type: UtilityBillType;
    review_status: 'pending_review';
    updated_at: string;
  }[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = extFromName(file.name, 'pdf');
      const path = `${landlordId}/${propertyId}/utilities/${ymd}-${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) {
        throw new Error(`上傳「${file.name}」失敗：${upErr.message}`);
      }
      uploadedPaths.push(path);
      rows.push({
        property_id: propertyId,
        landlord_id: landlordId,
        bill_month: monthDate,
        storage_path: path,
        original_filename: file.name,
        tenant_payable_hkd: payable,
        bill_type: billType,
        review_status: 'pending_review',
        updated_at: new Date().toISOString(),
      });
    }

    const { error: insErr } = await supabase.from('property_utility_bills').insert(rows);
    if (insErr) {
      throw new Error(`儲存紀錄失敗：${insErr.message}`);
    }

    return files.length;
  } catch (err) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths);
    }
    throw err;
  }
}

/** @deprecated 請改用 uploadPropertyUtilityBills */
export async function uploadPropertyUtilityBill(
  landlordId: string,
  propertyId: string,
  billMonth: string,
  file: File
): Promise<void> {
  await uploadPropertyUtilityBills(landlordId, propertyId, billMonth, 'water', [file], 0);
}
