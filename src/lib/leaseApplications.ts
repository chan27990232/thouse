import { supabase } from './supabase';
import type { ApplicationData } from '../components/RentalApplication';
import {
  computeFirstPaymentTotal,
  type PaymentMethodCode,
} from './leaseFirstPayment';

export { computeFirstPaymentTotal } from './leaseFirstPayment';

export interface PaymentRecordInput {
  method: PaymentMethodCode;
  /** 僅信用卡 */
  cardLast4?: string;
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
  const paymentStatus: 'succeeded' | 'pending_bank' =
    payment.method === 'bank_transfer' ? 'pending_bank' : 'succeeded';
  const paidAt = payment.method === 'bank_transfer' ? null : new Date().toISOString();

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
    status: 'pending',
    payment_method: payment.method,
    payment_status: paymentStatus,
    payment_reference: paymentReference,
    card_last4: payment.method === 'card' ? payment.cardLast4 ?? null : null,
    paid_at: paidAt,
  };

  const { error } = await supabase.from('lease_applications').insert(row);

  if (error) {
    const msg = (error.message || '').toLowerCase();
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
    .eq('status', 'pending')
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
