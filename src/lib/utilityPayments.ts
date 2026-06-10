import { supabase } from './supabase';
import { appTodayIso } from './appClock';
import type { LeasePaymentSubmitMethod } from './leaseFirstPayment';
import { formatDeadlineLabel } from './paymentDeadlines';
import { utilityBillTypeLabel, type UtilityBillType } from './propertyUtilityBills';

export type { UtilityBillType };
export { utilityBillTypeLabel };

export type UtilityPaymentStatus = 'pending' | 'pending_bank' | 'paid' | 'overdue';

export interface UtilityPaymentSummary {
  id: string;
  propertyId: string;
  propertyTitle: string;
  billMonth: string;
  billType: UtilityBillType | 'legacy' | null;
  amount: number;
  dueDate: string;
  uploadAt: string;
  status: UtilityPaymentStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
}

export function getUtilityPaymentStatusLabel(status: UtilityPaymentStatus): string {
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

export function resolveUtilityDisplayStatus(row: UtilityPaymentSummary): UtilityPaymentStatus {
  if (row.status === 'pending' && row.dueDate < appTodayIso()) {
    return 'overdue';
  }
  return row.status;
}

/** 待繳或逾期均可繳付（逾期後仍可補交） */
export function isUtilityPaymentActionable(row: UtilityPaymentSummary): boolean {
  const status = resolveUtilityDisplayStatus(row);
  return status === 'pending' || status === 'overdue';
}

type DbRow = {
  id: string;
  property_id: string;
  bill_month: string;
  bill_type: string | null;
  amount: number;
  due_date: string;
  upload_at: string;
  status: UtilityPaymentStatus;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  properties: { title: string | null } | null;
};

function mapRow(raw: DbRow): UtilityPaymentSummary {
  const base: UtilityPaymentSummary = {
    id: raw.id,
    propertyId: raw.property_id,
    propertyTitle: raw.properties?.title?.trim() || '未知物業',
    billMonth: raw.bill_month,
    billType: (raw.bill_type as UtilityBillType | 'legacy' | null) ?? null,
    amount: Number(raw.amount) || 0,
    dueDate: raw.due_date,
    uploadAt: raw.upload_at,
    status: raw.status,
    paymentMethod: raw.payment_method,
    paymentReference: raw.payment_reference,
    paidAt: raw.paid_at,
  };
  return { ...base, status: resolveUtilityDisplayStatus(base) };
}

export async function fetchUtilityPaymentsForTenant(): Promise<UtilityPaymentSummary[]> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return [];

  const { data, error } = await supabase
    .from('tenant_utility_obligations')
    .select(
      `id, property_id, bill_month, bill_type, amount, due_date, upload_at, status, payment_method, payment_reference, paid_at,
       properties ( title )`
    )
    .eq('tenant_id', user.id)
    .order('due_date', { ascending: false });

  if (error) {
    if ((error.message || '').toLowerCase().includes('tenant_utility_obligations')) {
      return [];
    }
    throw new Error(error.message || '無法載入水電煤紀錄');
  }

  return ((data ?? []) as DbRow[]).map(mapRow);
}

export async function fetchUtilityPaymentsForProperty(propertyId: string): Promise<UtilityPaymentSummary[]> {
  const all = await fetchUtilityPaymentsForTenant();
  return all
    .filter((r) => r.propertyId === propertyId)
    .sort((a, b) => {
      const monthCmp = b.billMonth.localeCompare(a.billMonth);
      if (monthCmp !== 0) return monthCmp;
      return (a.billType ?? '').localeCompare(b.billType ?? '');
    });
}

export function groupUtilityPaymentsByMonth(
  payments: UtilityPaymentSummary[]
): [string, UtilityPaymentSummary[]][] {
  const map = new Map<string, UtilityPaymentSummary[]>();
  for (const p of payments) {
    const key = p.billMonth.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export function findPrimaryUtilityPayMonth(payments: UtilityPaymentSummary[]): string | null {
  const groups = groupUtilityPaymentsByMonth(payments);
  const actionable = groups.find(([, items]) => items.some((p) => isUtilityPaymentActionable(p)));
  return actionable?.[0] ?? groups[0]?.[0] ?? null;
}

export function formatUtilityBillMonthLabel(billMonth: string): string {
  return billMonth.slice(0, 7);
}

export function formatUtilityDueLabel(dueDate: string): string {
  return formatDeadlineLabel(dueDate);
}

export async function submitUtilityPayment(
  obligationId: string,
  method: LeasePaymentSubmitMethod,
  receiptUrl: string
) {
  const { data, error } = await supabase.rpc('submit_utility_payment', {
    p_obligation_id: obligationId,
    p_method: method,
    p_receipt_url: receiptUrl,
  });
  if (error) {
    const raw = error.message || '';
    if (raw.toLowerCase().includes('submit_utility_payment')) {
      throw new Error('資料庫尚未建立水電煤繳付功能。請執行 supabase/submit_utility_payment_rpc.sql。');
    }
    throw new Error(raw || '無法提交水電煤款項');
  }
  return data as Record<string, unknown>;
}
