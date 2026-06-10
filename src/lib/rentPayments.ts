import { supabase } from './supabase';
import { appTodayIso, parseDateOnly } from './appClock';
import { computeRentBillingMonthStart } from './paymentDeadlines';
import type { LeasePaymentSubmitMethod } from './leaseFirstPayment';

export type RentPaymentStatus = 'pending' | 'pending_bank' | 'paid' | 'overdue';

export interface RentPaymentSummary {
  id: string;
  leaseApplicationId: string;
  propertyId: string;
  propertyTitle: string;
  periodIndex: number;
  /** 繳付期限（下月 7 日 23:59 前，遇假期提前） */
  dueDate: string;
  amount: number;
  status: RentPaymentStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  moveInDate: string | null;
}

export interface SubmitRentPaymentResult {
  paymentReference: string;
  amount: number;
  dueDate: string;
  periodIndex: number;
  status: 'paid';
  nextPaymentId: string | null;
}

export function getRentPaymentStatusLabel(status: RentPaymentStatus): string {
  switch (status) {
    case 'pending':
      return '待繳';
    case 'pending_bank':
      return '待入數核對';
    case 'paid':
      return '已支付';
    case 'overdue':
      return '逾期';
    default:
      return status;
  }
}

/** 帳單月開始後可繳租（逾期後仍可繳付） */
export function isRentPaymentActionable(payment: RentPaymentSummary): boolean {
  const status = resolveDisplayStatus(payment);
  if (status !== 'pending' && status !== 'overdue') {
    return false;
  }
  const today = appTodayIso();
  if (!payment.moveInDate) {
    return true;
  }
  const billingStart = computeRentBillingMonthStart(payment.moveInDate, payment.periodIndex);
  return today >= billingStart;
}

export function resolveDisplayStatus(payment: RentPaymentSummary): RentPaymentStatus {
  if (payment.status === 'pending' && payment.dueDate < appTodayIso()) {
    return 'overdue';
  }
  return payment.status;
}

type RentPaymentRowDb = {
  id: string;
  lease_application_id: string;
  property_id: string;
  period_index: number;
  due_date: string;
  amount: number;
  status: RentPaymentStatus;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  lease_applications: {
    move_in_date: string | null;
    properties: { title: string | null } | null;
  } | null;
};

function mapRow(raw: RentPaymentRowDb): RentPaymentSummary {
  const status = resolveDisplayStatus({
    id: raw.id,
    leaseApplicationId: raw.lease_application_id,
    propertyId: raw.property_id,
    propertyTitle: raw.lease_applications?.properties?.title?.trim() || '未知物業',
    periodIndex: raw.period_index,
    dueDate: raw.due_date,
    amount: Number(raw.amount) || 0,
    status: raw.status,
    paymentMethod: raw.payment_method,
    paymentReference: raw.payment_reference,
    paidAt: raw.paid_at,
    moveInDate: raw.lease_applications?.move_in_date ?? null,
  });

  return {
    id: raw.id,
    leaseApplicationId: raw.lease_application_id,
    propertyId: raw.property_id,
    propertyTitle: raw.lease_applications?.properties?.title?.trim() || '未知物業',
    periodIndex: raw.period_index,
    dueDate: raw.due_date,
    amount: Number(raw.amount) || 0,
    status,
    paymentMethod: raw.payment_method,
    paymentReference: raw.payment_reference,
    paidAt: raw.paid_at,
    moveInDate: raw.lease_applications?.move_in_date ?? null,
  };
}

export async function fetchRentPaymentsForTenant(): Promise<RentPaymentSummary[]> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return [];

  const { data, error } = await supabase
    .from('rent_payments')
    .select(
      `
      id,
      lease_application_id,
      property_id,
      period_index,
      due_date,
      amount,
      status,
      payment_method,
      payment_reference,
      paid_at,
      lease_applications (
        move_in_date,
        properties ( title )
      )
    `
    )
    .eq('tenant_id', user.id)
    .order('due_date', { ascending: false });

  if (error) {
    if ((error.message || '').toLowerCase().includes('rent_payments')) {
      throw new Error('資料庫尚未建立 rent_payments 表。請執行 npm run db:apply 或 supabase/rent_payments.sql。');
    }
    throw new Error(error.message || '無法載入租金紀錄');
  }

  return ((data ?? []) as RentPaymentRowDb[]).map(mapRow);
}

export async function fetchRentPaymentsForLease(
  leaseApplicationId: string
): Promise<RentPaymentSummary[]> {
  const all = await fetchRentPaymentsForTenant();
  return all.filter((p) => p.leaseApplicationId === leaseApplicationId);
}

export function formatDueDateLabel(dueDateIso: string): string {
  return parseDateOnly(dueDateIso).toLocaleDateString('zh-HK');
}

export async function submitRentPayment(
  rentPaymentId: string,
  method: LeasePaymentSubmitMethod,
  receiptUrl: string
): Promise<SubmitRentPaymentResult> {
  const { data, error } = await supabase.rpc('submit_rent_payment', {
    p_rent_payment_id: rentPaymentId,
    p_method: method,
    p_receipt_url: receiptUrl,
  });

  if (error) {
    const raw = error.message || '';
    if (raw.toLowerCase().includes('submit_rent_payment')) {
      throw new Error('資料庫尚未建立繳租功能。請執行 supabase/submit_rent_payment_rpc.sql。');
    }
    throw new Error(raw || '無法提交租金');
  }

  const row = data as Record<string, unknown>;
  return {
    paymentReference: String(row.payment_reference ?? ''),
    amount: Number(row.amount) || 0,
    dueDate: String(row.due_date ?? ''),
    periodIndex: Number(row.period_index) || 0,
    status: 'paid',
    nextPaymentId: row.next_payment_id ? String(row.next_payment_id) : null,
  };
}
