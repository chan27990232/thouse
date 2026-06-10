import { supabase } from './supabase';
import { utilityBillTypeLabel } from './propertyUtilityBills';

export { utilityBillTypeLabel };

export type UtilityBillReviewStatus = 'pending_review' | 'approved' | 'rejected';

export interface TenantUtilityBillFile {
  id: string;
  billMonth: string;
  billType: string | null;
  originalFilename: string | null;
  storagePath: string;
  tenantPayableHkd: number | null;
  reviewStatus: UtilityBillReviewStatus;
  uploadedAt: string;
  viewUrl: string | null;
}

type DbRow = {
  id: string;
  bill_month: string;
  bill_type: string | null;
  original_filename: string | null;
  storage_path: string;
  tenant_payable_hkd: number | null;
  review_status: UtilityBillReviewStatus;
  created_at: string;
  updated_at: string;
};

export function getUtilityBillReviewStatusLabel(status: UtilityBillReviewStatus): string {
  switch (status) {
    case 'pending_review':
      return '待平台審核';
    case 'approved':
      return '已核准';
    case 'rejected':
      return '已駁回';
    default:
      return status;
  }
}

export async function fetchTenantUtilityBillsForProperty(
  propertyId: string
): Promise<TenantUtilityBillFile[]> {
  const { data, error } = await supabase
    .from('property_utility_bills')
    .select(
      'id, bill_month, bill_type, original_filename, storage_path, tenant_payable_hkd, review_status, created_at, updated_at'
    )
    .eq('property_id', propertyId)
    .order('bill_month', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if ((error.message || '').toLowerCase().includes('property_utility_bills')) {
      return [];
    }
    throw new Error(error.message || '無法載入水電煤帳單');
  }

  const rows = (data ?? []) as DbRow[];
  const urlMap: Record<string, string> = {};

  await Promise.all(
    rows.map(async (row) => {
      if (row.review_status !== 'approved') return;
      const { data: signed } = await supabase.storage
        .from('property-verification')
        .createSignedUrl(row.storage_path, 3600);
      if (signed?.signedUrl) urlMap[row.id] = signed.signedUrl;
    })
  );

  return rows.map((row) => ({
    id: row.id,
    billMonth: row.bill_month,
    billType: row.bill_type ?? null,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    tenantPayableHkd: row.tenant_payable_hkd != null ? Number(row.tenant_payable_hkd) : null,
    reviewStatus: row.review_status,
    uploadedAt: row.updated_at || row.created_at,
    viewUrl: urlMap[row.id] ?? null,
  }));
}

export function resolveUtilityMonthReviewStatus(files: TenantUtilityBillFile[]): UtilityBillReviewStatus {
  if (files.length === 0) return 'pending_review';
  const statuses = new Set(files.map((f) => f.reviewStatus));
  if (statuses.has('pending_review')) return 'pending_review';
  if (statuses.has('approved')) return 'approved';
  return 'rejected';
}

export function sumMonthUtilityPayable(files: TenantUtilityBillFile[]): number | null {
  const byType = new Map<string, number>();
  for (const f of files) {
    if (f.tenantPayableHkd == null) continue;
    const n = Number(f.tenantPayableHkd);
    if (!Number.isFinite(n) || n <= 0) continue;
    const key = f.billType ?? 'legacy';
    byType.set(key, Math.max(byType.get(key) ?? 0, n));
  }
  if (byType.size === 0) return null;
  let sum = 0;
  for (const v of byType.values()) sum += v;
  return sum;
}

export function groupUtilityBillsByMonth(files: TenantUtilityBillFile[]) {
  const map = new Map<string, TenantUtilityBillFile[]>();
  for (const f of files) {
    const key = f.billMonth.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(f);
    map.set(key, list);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
