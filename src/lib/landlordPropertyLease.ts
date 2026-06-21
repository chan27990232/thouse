import { supabase } from './supabase';
import { getLeaseWorkflowStatusLabel } from './leaseApplications';
import type { LeaseManagementRequestFileRecord } from './leaseManagementRequestFiles';
import { getRentPaymentStatusLabel, type RentPaymentStatus } from './rentPayments';

export type LandlordLeaseAction = 'early_end' | 'renew' | 'breach';

export type LeaseManagementRequestStatus = 'awaiting_tenant' | 'pending' | 'approved' | 'rejected';

export interface LeaseManagementRequestSummary {
  id: string;
  leaseApplicationId: string;
  requestType: LandlordLeaseAction;
  status: LeaseManagementRequestStatus;
  notes: string;
  renewalMonths: number | null;
  earlyEndDate: string | null;
  adminNotes: string;
  createdAt: string;
  reviewedAt: string | null;
  files: LeaseManagementRequestFileRecord[];
}

export const LEASE_MANAGEMENT_ACTION_LABELS: Record<LandlordLeaseAction, string> = {
  early_end: '提早結束租約',
  renew: '續約',
  breach: '違約',
};

export const LEASE_MANAGEMENT_REQUEST_STATUS_LABELS: Record<LeaseManagementRequestStatus, string> = {
  awaiting_tenant: '等候租客確認',
  pending: '待平台審核',
  approved: '已核准',
  rejected: '已駁回',
};

export interface LandlordPropertyLeaseInfo {
  leaseApplicationId: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  moveInDate: string | null;
  leaseMonths: number | null;
  leaseNotes: string;
  landlordManagementNotes: string;
  lastRenewedAt: string | null;
  nextDueDate: string | null;
  nextRentStatus: RentPaymentStatus | null;
  nextRentAmount: number | null;
}

const EMPTY_LEASE_INFO: LandlordPropertyLeaseInfo = {
  leaseApplicationId: null,
  tenantName: null,
  tenantEmail: null,
  tenantPhone: null,
  moveInDate: null,
  leaseMonths: null,
  leaseNotes: '',
  landlordManagementNotes: '',
  lastRenewedAt: null,
  nextDueDate: null,
  nextRentStatus: null,
  nextRentAmount: null,
};

export function formatLandlordNextDueLabel(
  hasActiveLease: boolean,
  info: Pick<LandlordPropertyLeaseInfo, 'nextDueDate' | 'nextRentStatus'>
): string {
  if (!hasActiveLease) return '待出租';
  if (!info.nextDueDate) return '尚無待繳帳單';
  const date = new Date(`${info.nextDueDate}T12:00:00`).toLocaleDateString('zh-HK');
  if (!info.nextRentStatus) return date;
  const status = getRentPaymentStatusLabel(info.nextRentStatus);
  return `${date}（${status}）`;
}

function mapLeaseRow(row: {
  id: string;
  property_id: string;
  full_name: string;
  email: string;
  phone: string;
  move_in_date: string | null;
  lease_duration_months: number;
  additional_notes: string | null;
  landlord_management_notes?: string | null;
  last_renewed_at?: string | null;
}): LandlordPropertyLeaseInfo {
  return {
    leaseApplicationId: row.id,
    tenantName: row.full_name?.trim() || null,
    tenantEmail: row.email?.trim() || null,
    tenantPhone: row.phone?.trim() || null,
    moveInDate: row.move_in_date,
    leaseMonths: row.lease_duration_months,
    leaseNotes: (row.additional_notes ?? '').trim(),
    landlordManagementNotes: (row.landlord_management_notes ?? '').trim(),
    lastRenewedAt: row.last_renewed_at ?? null,
    nextDueDate: null,
    nextRentStatus: null,
    nextRentAmount: null,
  };
}

/** 業主物業列表：批次載入核准租約與下一期租金 */
export async function fetchLandlordLeaseInfoByPropertyIds(
  landlordId: string,
  propertyIds: string[]
): Promise<Record<string, LandlordPropertyLeaseInfo>> {
  if (propertyIds.length === 0) return {};

  const [leasesRes, rentsRes] = await Promise.all([
    supabase
      .from('lease_applications')
      .select(
        'id, property_id, full_name, email, phone, move_in_date, lease_duration_months, additional_notes, landlord_management_notes, last_renewed_at, created_at'
      )
      .eq('landlord_id', landlordId)
      .eq('status', 'approved')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('rent_payments')
      .select('property_id, due_date, status, amount')
      .eq('landlord_id', landlordId)
      .in('property_id', propertyIds)
      .in('status', ['pending', 'pending_bank', 'overdue'])
      .order('due_date', { ascending: true }),
  ]);

  if (leasesRes.error && !leasesRes.error.message.includes('does not exist')) {
    console.error('[landlordPropertyLease] lease_applications', leasesRes.error.message);
  }

  const result: Record<string, LandlordPropertyLeaseInfo> = {};
  for (const row of leasesRes.data ?? []) {
    const pid = row.property_id as string;
    if (!result[pid]) {
      result[pid] = mapLeaseRow(
        row as {
          id: string;
          property_id: string;
          full_name: string;
          email: string;
          phone: string;
          move_in_date: string | null;
          lease_duration_months: number;
          additional_notes: string | null;
          landlord_management_notes: string | null;
          last_renewed_at: string | null;
        }
      );
    }
  }

  const rentRows = rentsRes.error ? [] : rentsRes.data ?? [];
  if (rentsRes.error && !rentsRes.error.message.toLowerCase().includes('does not exist')) {
    console.error('[landlordPropertyLease] rent_payments', rentsRes.error.message);
  }

  for (const row of rentRows) {
    const pid = row.property_id as string;
    if (!result[pid]) {
      result[pid] = { ...EMPTY_LEASE_INFO };
    }
    if (!result[pid].nextDueDate) {
      result[pid] = {
        ...result[pid],
        nextDueDate: row.due_date as string,
        nextRentStatus: row.status as RentPaymentStatus,
        nextRentAmount: Number(row.amount ?? 0),
      };
    }
  }

  return result;
}

/** 最近一筆租約申請（含已結束），用於無進行中租約時的說明 */
export async function fetchLatestLeaseApplicationHint(
  landlordId: string,
  propertyId: string
): Promise<{ status: string; statusLabel: string; tenantName: string | null } | null> {
  const { data, error } = await supabase
    .from('lease_applications')
    .select('status, full_name')
    .eq('landlord_id', landlordId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const status = data.status as string;
  return {
    status,
    statusLabel: getLeaseWorkflowStatusLabel(status),
    tenantName: (data.full_name as string)?.trim() || null,
  };
}

export async function fetchLandlordPropertyLeaseDetail(
  landlordId: string,
  propertyId: string
): Promise<LandlordPropertyLeaseInfo> {
  const map = await fetchLandlordLeaseInfoByPropertyIds(landlordId, [propertyId]);
  return map[propertyId] ?? { ...EMPTY_LEASE_INFO };
}

export async function updateLandlordPropertyMonthlyRent(
  propertyId: string,
  monthlyRent: number
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const amount = Math.round(monthlyRent);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('請輸入有效的月租金額');
  }

  const { error } = await supabase
    .from('properties')
    .update({ price: amount })
    .eq('id', propertyId)
    .eq('landlord_id', user.id);

  if (error) throw new Error(error.message || '無法更新月租');
}

/** 業主提交租約變更申請（待管理員審核） */
export async function submitLandlordLeaseManagementRequest(input: {
  leaseApplicationId: string;
  action: LandlordLeaseAction;
  notes?: string;
  renewalMonths?: number;
  earlyEndDate?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('landlord_manage_lease', {
    p_lease_application_id: input.leaseApplicationId,
    p_action: input.action,
    p_notes: input.notes?.trim() ?? '',
    p_renewal_months: input.renewalMonths ?? null,
    p_early_end_date: input.earlyEndDate ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('lease_management_requests') || msg.includes('does not exist')) {
      throw new Error('資料庫尚未套用 lease_management_requests_workflow.sql');
    }
    if (msg.includes('landlord_manage_lease') && msg.includes('schema cache')) {
      throw new Error('資料庫尚未套用租約變更申請功能，請執行 migration');
    }
    throw new Error(msg || '無法提交申請');
  }

  return typeof data === 'string' ? data : '';
}

export async function fetchLeaseManagementRequestsForLease(
  leaseApplicationId: string
): Promise<LeaseManagementRequestSummary[]> {
  const { data, error } = await supabase
    .from('lease_management_requests')
    .select(
      'id, lease_application_id, request_type, status, notes, renewal_months, early_end_date, admin_notes, created_at, reviewed_at'
    )
    .eq('lease_application_id', leaseApplicationId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.message.includes('lease_management_requests')) return [];
    throw new Error(error.message || '無法載入申請紀錄');
  }

  const requests = (data ?? []).map((row) => ({
    id: row.id as string,
    leaseApplicationId: row.lease_application_id as string,
    requestType: row.request_type as LandlordLeaseAction,
    status: row.status as LeaseManagementRequestStatus,
    notes: (row.notes as string) ?? '',
    renewalMonths: row.renewal_months != null ? Number(row.renewal_months) : null,
    earlyEndDate: (row.early_end_date as string | null) ?? null,
    adminNotes: (row.admin_notes as string) ?? '',
    createdAt: row.created_at as string,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    files: [] as LeaseManagementRequestFileRecord[],
  }));

  if (requests.length === 0) return requests;

  const ids = requests.map((r) => r.id);
  const { data: fileRows } = await supabase
    .from('lease_management_request_files')
    .select('id, request_id, file_name, storage_path, file_size_bytes, mime_type, created_at')
    .in('request_id', ids)
    .order('created_at', { ascending: true });

  const filesByRequest = new Map<string, LeaseManagementRequestFileRecord[]>();
  for (const row of fileRows ?? []) {
    const rid = row.request_id as string;
    const list = filesByRequest.get(rid) ?? [];
    list.push({
      id: row.id as string,
      fileName: row.file_name as string,
      storagePath: row.storage_path as string,
      fileSizeBytes: Number(row.file_size_bytes),
      mimeType: (row.mime_type as string | null) ?? null,
      createdAt: row.created_at as string,
    });
    filesByRequest.set(rid, list);
  }

  return requests.map((r) => ({ ...r, files: filesByRequest.get(r.id) ?? [] }));
}

export function getPendingLeaseManagementRequest(
  requests: LeaseManagementRequestSummary[]
): LeaseManagementRequestSummary | null {
  return (
    requests.find((r) => r.status === 'pending' || r.status === 'awaiting_tenant') ?? null
  );
}
