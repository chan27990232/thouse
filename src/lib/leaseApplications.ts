import { supabase } from './supabase';
import type { ApplicationData } from '../components/RentalApplication';
import {
  computeFirstPaymentTotal,
  type LeasePaymentSubmitMethod,
  type PaymentMethodCode,
} from './leaseFirstPayment';
import { assertCurrentUserVerified } from './identityVerification';

export { computeFirstPaymentTotal } from './leaseFirstPayment';

export type LeaseWorkflowStatus =
  | 'awaiting_platform_1'
  | 'awaiting_landlord'
  | 'awaiting_platform_2'
  | 'approved'
  | 'rejected'
  | 'ended_early'
  | 'ended_breach';

export const LEASE_WORKFLOW_STATUS_LABELS: Record<LeaseWorkflowStatus, string> = {
  awaiting_platform_1: '待平台審核（一審）',
  awaiting_landlord: '待業主確認',
  awaiting_platform_2: '待平台複審',
  approved: '已核准',
  rejected: '已拒絕',
  ended_early: '提早結束',
  ended_breach: '違約結束',
};

export function getLeaseWorkflowStatusLabel(code: string): string {
  const k = code as LeaseWorkflowStatus;
  return LEASE_WORKFLOW_STATUS_LABELS[k] ?? code;
}

export interface PaymentRecordInput {
  method: LeasePaymentSubmitMethod;
  /** 轉數快／銀行轉賬：租客上傳之收據／截圖公開 URL */
  bankTransferReceiptUrl?: string | null;
}

export interface SubmitLeaseInput {
  propertyId: string;
  landlordId: string;
  monthlyPrice: number;
  applicationData: ApplicationData;
  payment: PaymentRecordInput;
}

export interface SubmitLeaseResult {
  paymentReference: string;
  paymentStatus: 'succeeded' | 'pending_bank';
  method: PaymentMethodCode;
}

/**
 * 租客完成付款步驟後寫入簽約申請與付款中繼資料。
 */
export async function submitLeaseApplication(input: SubmitLeaseInput): Promise<SubmitLeaseResult> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error('請先登入');
  }
  await assertCurrentUserVerified('請先完成實名驗證，方可簽約。可到個人資料提交申請。');
  if (!input.landlordId) {
    throw new Error('無法識別物業業主，請重新整理物業列表後再試。');
  }

  const { applicationData, propertyId, landlordId, monthlyPrice, payment } = input;
  const moveIn =
    applicationData.moveInDate instanceof Date
      ? applicationData.moveInDate.toISOString().slice(0, 10)
      : null;

  const firstPayment = computeFirstPaymentTotal(monthlyPrice);
  const paymentReference = crypto.randomUUID();
  const awaitingProof =
    payment.method === 'bank_transfer' ||
    (payment.method === 'fps' && Boolean(payment.bankTransferReceiptUrl?.trim()));
  const paymentStatus: 'succeeded' | 'pending_bank' = awaitingProof ? 'pending_bank' : 'succeeded';
  const paidAt = awaitingProof ? null : new Date().toISOString();

  const row: Record<string, unknown> = {
    property_id: propertyId,
    tenant_id: user.id,
    landlord_id: landlordId,
    full_name: applicationData.fullName.trim(),
    phone: applicationData.phone.trim(),
    email: applicationData.email.trim(),
    move_in_date: moveIn,
    lease_duration_months: Math.max(1, parseInt(applicationData.leaseDuration, 10) || 12),
    emergency_contact: applicationData.emergencyContact.trim(),
    emergency_phone: applicationData.emergencyPhone.trim(),
    additional_notes: applicationData.additionalNotes.trim(),
    first_payment_total: firstPayment,
    status: 'awaiting_platform_1',
    payment_method: payment.method,
    payment_status: paymentStatus,
    payment_reference: paymentReference,
    card_last4: null,
    paid_at: paidAt,
    bank_transfer_receipt_url:
      payment.method === 'bank_transfer' || payment.method === 'fps'
        ? payment.bankTransferReceiptUrl?.trim() || null
        : null,
  };

  const { error } = await supabase.from('lease_applications').insert(row);

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const raw = error.message || '';
    if (msg.includes('lease_applications_status_check') || (msg.includes('status') && msg.includes('check'))) {
      throw new Error(
        '無法送出：資料庫「租約狀態」尚未套用最新流程（lease_application_workflow.sql）。請在 Supabase SQL Editor 執行後再試。原始錯誤：'.concat(raw)
      );
    }
    if (msg.includes('column') && msg.includes('bank_transfer_receipt')) {
      throw new Error(
        '資料庫尚未建立「轉賬證明」欄位。請在 Supabase 執行 supabase/lease_application_bank_proof.sql。'
      );
    }
    if (msg.includes('column') && msg.includes('payment')) {
      throw new Error(
        '資料庫尚未建立付款欄位。請在 Supabase 執行 supabase/lease_applications.sql（或 lease_applications_payment_columns.sql）後再試。'
      );
    }
    throw new Error(error.message || '提交簽約失敗');
  }

  return { paymentReference, paymentStatus, method: payment.method };
}

export async function fetchPendingApplicationCounts(
  landlordId: string,
  propertyIds: string[]
): Promise<Record<string, number>> {
  if (propertyIds.length === 0) return {};
  const { data, error } = await supabase
    .from('lease_applications')
    .select('property_id')
    .eq('landlord_id', landlordId)
    .eq('status', 'awaiting_landlord')
    .in('property_id', propertyIds);

  if (error || !data) {
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data) {
    const pid = row.property_id as string;
    counts[pid] = (counts[pid] ?? 0) + 1;
  }
  return counts;
}

export function getLeasePaymentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'succeeded':
      return '已記帳';
    case 'pending_bank':
      return '待入數核對';
    case 'failed':
      return '失敗';
    case null:
    case '':
      return '—';
    default:
      return status;
  }
}

/** 租客「我的租盤申請」列表用 */
export interface TenantLeaseApplicationSummary {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyImage: string | null;
  propertyDistrict: string | null;
  propertyArea: number;
  propertyFloor: number;
  propertyBedrooms: number;
  propertyBathrooms: number;
  monthlyRent: number;
  moveInDate: string | null;
  leaseMonths: number;
  firstPaymentTotal: number;
  applicationStatus: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentReference: string | null;
  bankTransferReceiptUrl?: string | null;
  createdAt: string;
}

/** 業主控制台「查看所有申請」列表用 */
export interface LandlordLeaseApplicationSummary {
  id: string;
  propertyId: string;
  propertyTitle: string;
  applicantName: string;
  phone: string;
  email: string;
  moveInDate: string | null;
  leaseMonths: number;
  firstPaymentTotal: number;
  applicationStatus: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentReference: string | null;
  createdAt: string;
}

type LeaseAppRowDb = {
  id: string;
  property_id: string;
  created_at: string;
  status: string;
  full_name: string;
  phone: string;
  email: string;
  move_in_date: string | null;
  lease_duration_months: number;
  first_payment_total: number;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  bank_transfer_receipt_url?: string | null;
  properties: {
    title: string | null;
    image?: string | null;
    district?: string | null;
    area?: number | null;
    floor?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    price?: number | null;
  } | null;
};

/**
 * 讀取目前登入租客名下全部簽約申請（RLS）。
 */
export async function fetchLeaseApplicationsForTenant(): Promise<TenantLeaseApplicationSummary[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('lease_applications')
    .select(
      `
      id,
      property_id,
      created_at,
      status,
      move_in_date,
      lease_duration_months,
      first_payment_total,
      payment_method,
      payment_status,
      payment_reference,
      bank_transfer_receipt_url,
      properties ( title, image, district, area, floor, bedrooms, bathrooms, price )
    `
    )
    .eq('tenant_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || '無法載入租盤進度');
  }

  const rows = (data ?? []) as LeaseAppRowDb[];
  return rows.map((raw) => ({
    id: raw.id,
    propertyId: raw.property_id,
    propertyTitle: raw.properties?.title?.trim() || '未知物業',
    propertyImage: raw.properties?.image?.trim() || null,
    propertyDistrict: raw.properties?.district?.trim() || null,
    propertyArea: Number(raw.properties?.area) || 0,
    propertyFloor: Number(raw.properties?.floor) || 0,
    propertyBedrooms: Number(raw.properties?.bedrooms) || 0,
    propertyBathrooms: Number(raw.properties?.bathrooms) || 0,
    monthlyRent: Number(raw.properties?.price) || 0,
    moveInDate: raw.move_in_date,
    leaseMonths: Math.max(1, Number(raw.lease_duration_months) || 12),
    firstPaymentTotal: Number(raw.first_payment_total) || 0,
    applicationStatus: raw.status ?? 'awaiting_platform_1',
    paymentMethod: raw.payment_method,
    paymentStatus: raw.payment_status,
    paymentReference: raw.payment_reference,
    bankTransferReceiptUrl: raw.bank_transfer_receipt_url?.trim() || null,
    createdAt: raw.created_at,
  }));
}

/**
 * 讀取目前登入業主名下全部租約／簽約申請（RLS）。
 */
export async function fetchLeaseApplicationsForLandlord(): Promise<LandlordLeaseApplicationSummary[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('lease_applications')
    .select(
      `
      id,
      property_id,
      created_at,
      status,
      full_name,
      phone,
      email,
      move_in_date,
      lease_duration_months,
      first_payment_total,
      payment_method,
      payment_status,
      payment_reference,
      properties ( title )
    `
    )
    .eq('landlord_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || '無法載入租約申請');
  }

  const rows = (data ?? []) as LeaseAppRowDb[];
  return rows.map((raw) => ({
    id: raw.id,
    propertyId: raw.property_id,
    propertyTitle: raw.properties?.title?.trim() || '未知物業',
    applicantName: raw.full_name?.trim() || '—',
    phone: raw.phone?.trim() || '—',
    email: raw.email?.trim() || '—',
    moveInDate: raw.move_in_date,
    leaseMonths: Math.max(1, Number(raw.lease_duration_months) || 12),
    firstPaymentTotal: Number(raw.first_payment_total) || 0,
    applicationStatus: raw.status ?? 'awaiting_platform_1',
    paymentMethod: raw.payment_method,
    paymentStatus: raw.payment_status,
    paymentReference: raw.payment_reference,
    createdAt: raw.created_at,
  }));
}

/**
 * 業主接受／拒絕租客租約申請（須先在 Supabase 執行 respond_to_lease_application_rpc.sql）。
 */
export async function respondToLeaseApplication(
  applicationId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_lease_application', {
    p_application_id: applicationId,
    p_decision: decision,
  });
  if (error) {
    const raw = typeof error.message === 'string' ? error.message : '';
    if (raw.toLowerCase().includes('respond_to_lease_application') && raw.toLowerCase().includes('schema cache')) {
      throw new Error(
        '資料庫尚未建立「業主回覆申請」功能，或 API 快取未更新。請在 Supabase SQL Editor 執行 supabase/respond_to_lease_application_rpc.sql，再到 Settings → API → Reload schema 後重試。'
      );
    }
    throw new Error(raw || '無法更新申請。請確認已在資料庫執行 respond_to_lease_application_rpc.sql。');
  }
}
