export const TENANT_PAID_STATUSES = new Set(['succeeded', 'pending_bank', 'paid']);

export function isTenantPaid(status: string | null | undefined) {
  return TENANT_PAID_STATUSES.has(status ?? '');
}

export type LeaseRecord = {
  id: string;
  property_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  move_in_date: string | null;
  lease_duration_months: number;
  first_payment_total: number;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  bank_transfer_receipt_url: string | null;
  paid_at: string | null;
  landlord_payout_status: string | null;
  landlord_paid_at: string | null;
  created_at?: string;
};

export type RentRecord = {
  id: string;
  property_id: string;
  lease_application_id: string;
  period_index: number;
  due_date: string;
  amount: number;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  bank_transfer_receipt_url: string | null;
  paid_at: string | null;
  landlord_payout_status: string | null;
  landlord_paid_at: string | null;
};

export type UtilityRecord = {
  id: string;
  property_id: string;
  bill_month: string;
  bill_type: string | null;
  original_filename: string | null;
  storage_path: string;
  tenant_payable_hkd: number | null;
  review_status: string;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UtilityObligationRecord = {
  id: string;
  property_id: string;
  lease_application_id: string | null;
  bill_month: string;
  bill_type: string | null;
  amount: number;
  due_date: string;
  upload_at: string;
  status: string;
  payment_method: string | null;
  bank_transfer_receipt_url: string | null;
  paid_at: string | null;
  landlord_payout_status: string | null;
  landlord_paid_at: string | null;
};

export type LeaseRecordGroup = {
  lease: LeaseRecord;
  rents: RentRecord[];
};

export type PropertyRecordsBundle = {
  propertyId: string;
  leases: LeaseRecord[];
  rents: RentRecord[];
  utilities: UtilityRecord[];
  /** 現時租約（最新已核准） */
  activeLease: LeaseRecord | null;
  /** 依租約分組，每組只含該租約的租金紀錄 */
  leaseGroups: LeaseRecordGroup[];
};

export type TenantPeriod = {
  rowKey: string;
  label: string;
  dueDate: string;
  amount: number;
  tenantStatus: string;
  paidAt: string | null;
};

export type UtilityPaymentPeriod = {
  rowKey: string;
  label: string;
  dueDate: string;
  amount: number;
  tenantStatus: string;
  paidAt: string | null;
};

export type PayoutPeriod = {
  rowKey: string;
  label: string;
  amount: number;
  tenantPaid: boolean;
  payoutStatus: string;
  landlordPaidAt: string | null;
};

export type PropertyRecordSnapshot = {
  tenantNext: string | null;
  tenantLast: string | null;
  utilityNext: string | null;
  utilityLast: string | null;
  payoutNext: string | null;
  payoutLast: string | null;
};

function addMonthYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function currentYm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function billMonthLabel(d: string) {
  return d?.slice(0, 7) ?? '—';
}

/** 租金帳單月（第 2 期 = 入住月） */
export function rentBillingMonthYm(moveInDate: string | null, periodIndex: number): string {
  if (!moveInDate) return '—';
  const base = new Date(`${moveInDate.slice(0, 10)}T12:00:00`);
  const billing = new Date(base.getFullYear(), base.getMonth() + (periodIndex - 2), 1);
  return `${billing.getFullYear()}-${String(billing.getMonth() + 1).padStart(2, '0')}`;
}

export function formatRentPeriodLabel(
  moveInDate: string | null,
  periodIndex: number | 'initial'
): string {
  if (periodIndex === 'initial') {
    const ym = moveInDate?.slice(0, 7) ?? '—';
    return `${ym} 租金（首期）`;
  }
  return `${rentBillingMonthYm(moveInDate, periodIndex)} 租金`;
}

export function formatUtilityObligationLabel(o: Pick<UtilityObligationRecord, 'bill_month' | 'bill_type'>): string {
  const ym = billMonthLabel(o.bill_month);
  const type =
    o.bill_type && o.bill_type !== 'legacy' ? utilityBillTypeLabel(o.bill_type) : '水電煤';
  return `${ym} ${type}`;
}

export function buildTenantPeriods(lease: LeaseRecord | null, rents: RentRecord[]): TenantPeriod[] {
  const items: TenantPeriod[] = [];
  if (lease && (lease.payment_method || lease.payment_status || lease.paid_at)) {
    items.push({
      rowKey: `lease-${lease.id}`,
      label: formatRentPeriodLabel(lease.move_in_date, 'initial'),
      dueDate: lease.move_in_date ?? '—',
      amount: lease.first_payment_total,
      tenantStatus: lease.payment_status ?? 'pending',
      paidAt: lease.paid_at,
    });
  }
  for (const r of rents) {
    items.push({
      rowKey: `rent-${r.id}`,
      label: formatRentPeriodLabel(lease?.move_in_date ?? null, r.period_index),
      dueDate: r.due_date,
      amount: r.amount,
      tenantStatus: r.status,
      paidAt: r.paid_at,
    });
  }
  return items;
}

export function buildPayoutPeriods(
  lease: LeaseRecord | null,
  rents: RentRecord[],
  utilityObligations: UtilityObligationRecord[] = []
): PayoutPeriod[] {
  const items: PayoutPeriod[] = [];
  if (lease && (lease.payment_method || lease.payment_status || lease.paid_at)) {
    items.push({
      rowKey: `lease-${lease.id}`,
      label: formatRentPeriodLabel(lease.move_in_date, 'initial'),
      amount: lease.first_payment_total,
      tenantPaid: isTenantPaid(lease.payment_status),
      payoutStatus: lease.landlord_payout_status ?? 'pending',
      landlordPaidAt: lease.landlord_paid_at,
    });
  }
  for (const r of rents) {
    items.push({
      rowKey: `rent-${r.id}`,
      label: formatRentPeriodLabel(lease?.move_in_date ?? null, r.period_index),
      amount: r.amount,
      tenantPaid: isTenantPaid(r.status),
      payoutStatus: r.landlord_payout_status ?? 'pending',
      landlordPaidAt: r.landlord_paid_at,
    });
  }
  for (const u of utilityObligations) {
    items.push({
      rowKey: `utility-${u.id}`,
      label: formatUtilityObligationLabel(u),
      amount: Number(u.amount) || 0,
      tenantPaid: isTenantPaid(u.status),
      payoutStatus: u.landlord_payout_status ?? 'pending',
      landlordPaidAt: u.landlord_paid_at,
    });
  }
  return items;
}

export function pickNextTenantDue(periods: TenantPeriod[]): TenantPeriod | null {
  const unpaid = periods.filter((p) => !isTenantPaid(p.tenantStatus));
  if (unpaid.length === 0) return null;
  return [...unpaid].sort((a, b) => {
    if (a.dueDate === '—') return 1;
    if (b.dueDate === '—') return -1;
    return a.dueDate.localeCompare(b.dueDate);
  })[0];
}

export function pickLastTenantPaid(periods: TenantPeriod[]): TenantPeriod | null {
  const paid = periods.filter((p) => isTenantPaid(p.tenantStatus) && p.paidAt);
  if (paid.length === 0) {
    const fallback = periods.filter((p) => isTenantPaid(p.tenantStatus));
    return fallback.length > 0 ? fallback[fallback.length - 1] : null;
  }
  return [...paid].sort((a, b) => (a.paidAt! < b.paidAt! ? 1 : -1))[0];
}

export function pickNextPayoutDue(periods: PayoutPeriod[]): PayoutPeriod | null {
  const pending = periods.filter((p) => p.tenantPaid && p.payoutStatus !== 'paid');
  return pending[0] ?? null;
}

export function pickLastPayoutPaid(periods: PayoutPeriod[]): PayoutPeriod | null {
  const paid = periods.filter((p) => p.payoutStatus === 'paid' && p.landlordPaidAt);
  if (paid.length === 0) {
    const fallback = periods.filter((p) => p.payoutStatus === 'paid');
    return fallback.length > 0 ? fallback[fallback.length - 1] : null;
  }
  return [...paid].sort((a, b) => (a.landlordPaidAt! < b.landlordPaidAt! ? 1 : -1))[0];
}

export function pickNextUtilityDue(utilities: UtilityRecord[]): { month: string } | null {
  const uploaded = new Set(utilities.map((u) => u.bill_month.slice(0, 7)));
  const cur = currentYm();
  if (!uploaded.has(cur)) return { month: cur };
  const latest = utilities[0]?.bill_month.slice(0, 7);
  if (!latest) return { month: cur };
  let probe = addMonthYm(latest);
  for (let i = 0; i < 24; i++) {
    if (!uploaded.has(probe)) return { month: probe };
    probe = addMonthYm(probe);
  }
  return { month: probe };
}

export function pickLastUtility(utilities: UtilityRecord[]): UtilityRecord | null {
  if (utilities.length === 0) return null;
  return [...utilities].sort((a, b) => {
    const at = a.updated_at || a.created_at;
    const bt = b.updated_at || b.created_at;
    return at < bt ? 1 : -1;
  })[0];
}

export function buildUtilityPaymentPeriods(obligations: UtilityObligationRecord[]): UtilityPaymentPeriod[] {
  return obligations
    .slice()
    .sort((a, b) => (a.bill_month < b.bill_month ? -1 : 1))
    .map((o) => ({
      rowKey: `utility-${o.id}`,
      label: formatUtilityObligationLabel(o),
      dueDate: o.due_date,
      amount: Number(o.amount) || 0,
      tenantStatus: o.status,
      paidAt: o.paid_at,
    }));
}

export function pickNextUtilityPaymentDue(periods: UtilityPaymentPeriod[]): UtilityPaymentPeriod | null {
  const unpaid = periods.filter((p) => !isTenantPaid(p.tenantStatus));
  if (unpaid.length === 0) return null;
  return [...unpaid].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

export function pickLastUtilityPaymentPaid(periods: UtilityPaymentPeriod[]): UtilityPaymentPeriod | null {
  const paid = periods.filter((p) => isTenantPaid(p.tenantStatus) && p.paidAt);
  if (paid.length === 0) {
    const fallback = periods.filter((p) => isTenantPaid(p.tenantStatus));
    return fallback.length > 0 ? fallback[fallback.length - 1] : null;
  }
  return [...paid].sort((a, b) => (a.paidAt! < b.paidAt! ? 1 : -1))[0];
}

const UTILITY_REVIEW_LABEL: Record<string, string> = {
  pending_review: '待審核',
  approved: '已核准',
  rejected: '已駁回',
};

export function utilityReviewStatusLabel(status: string | null | undefined) {
  return UTILITY_REVIEW_LABEL[status ?? ''] ?? status ?? '—';
}

/** 以月份內所有檔案推斷審核狀態（有待審核即視為待審核） */
export function resolveUtilityMonthReviewStatus(files: UtilityRecord[]): string {
  if (files.length === 0) return 'pending_review';
  const statuses = new Set(files.map((f) => f.review_status ?? 'pending_review'));
  if (statuses.has('pending_review')) return 'pending_review';
  if (statuses.has('approved')) return 'approved';
  return 'rejected';
}

export function pickPendingUtilityReviewMonths(utilities: UtilityRecord[]): string[] {
  const groups = groupUtilityRecordsByMonth(utilities);
  return groups
    .filter(([, files]) => resolveUtilityMonthReviewStatus(files) === 'pending_review')
    .map(([month]) => month)
    .sort((a, b) => (a < b ? 1 : -1));
}

export function groupUtilityRecordsByMonth(utilities: UtilityRecord[]): [string, UtilityRecord[]][] {
  const map = new Map<string, UtilityRecord[]>();
  for (const u of utilities) {
    const key = u.bill_month.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(u);
    map.set(key, list);
  }
  for (const [, files] of map) {
    files.sort((a, b) => {
      const at = a.updated_at || a.created_at;
      const bt = b.updated_at || b.created_at;
      return at < bt ? 1 : -1;
    });
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

const UTILITY_BILL_TYPE_LABEL: Record<string, string> = {
  water: '水費',
  electricity: '電費',
  gas: '煤氣費',
};

export function utilityBillTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return UTILITY_BILL_TYPE_LABEL[type] ?? type;
}

/** 各帳單類型取最高應付後加總 */
export function getUtilityMonthPayable(files: UtilityRecord[]): number | null {
  const byType = new Map<string, number>();
  for (const f of files) {
    if (f.tenant_payable_hkd == null) continue;
    const n = Number(f.tenant_payable_hkd);
    if (!Number.isFinite(n) || n <= 0) continue;
    const key = f.bill_type ?? 'legacy';
    byType.set(key, Math.max(byType.get(key) ?? 0, n));
  }
  if (byType.size === 0) return null;
  let sum = 0;
  for (const v of byType.values()) sum += v;
  return sum;
}

export function getUtilityMonthLatestAt(files: UtilityRecord[]): string | null {
  if (files.length === 0) return null;
  const latest = files.reduce((best, f) => {
    const t = f.updated_at || f.created_at;
    const bt = best.updated_at || best.created_at;
    return t > bt ? f : best;
  });
  return latest.updated_at || latest.created_at;
}

export function truncateFilename(name: string | null | undefined, maxLen = 36): string {
  const n = (name ?? '').trim();
  if (!n) return '未命名檔案';
  if (n.length <= maxLen) return n;
  const ext = n.includes('.') ? n.slice(n.lastIndexOf('.')) : '';
  const baseMax = Math.max(8, maxLen - ext.length - 1);
  return `${n.slice(0, baseMax)}…${ext}`;
}

export function utilityMonthHighlightClass(
  month: string,
  nextUploadMonth: string | null | undefined,
  lastUploadMonth: string | null | undefined
): string {
  if (month === nextUploadMonth) return 'utility-month-card--next';
  if (month === lastUploadMonth && month !== nextUploadMonth) return 'utility-month-card--last';
  return '';
}

export function leaseHasPaymentActivity(lease: LeaseRecord, rents: RentRecord[]) {
  return Boolean(
    lease.payment_method ||
      lease.payment_status ||
      lease.paid_at ||
      rents.some((r) => r.lease_application_id === lease.id)
  );
}

/** 單一租盤：租約分組，每組租金只屬於該租約 */
export function buildPropertyRecordsBundle(
  propertyId: string,
  leases: LeaseRecord[],
  rents: RentRecord[],
  utilities: UtilityRecord[]
): PropertyRecordsBundle {
  const propertyLeases = leases
    .filter((l) => l.property_id === propertyId)
    .sort((a, b) => (a.created_at && b.created_at ? (a.created_at < b.created_at ? 1 : -1) : 0));
  const propertyRents = rents.filter((r) => r.property_id === propertyId);
  const propertyUtilities = utilities
    .filter((u) => u.property_id === propertyId)
    .sort((a, b) => (a.bill_month < b.bill_month ? 1 : -1));

  const leaseGroups: LeaseRecordGroup[] = propertyLeases
    .filter((lease) => leaseHasPaymentActivity(lease, propertyRents))
    .map((lease) => ({
      lease,
      rents: propertyRents
        .filter((r) => r.lease_application_id === lease.id)
        .sort((a, b) => a.period_index - b.period_index),
    }));

  const activeLease = propertyLeases.find((l) => l.status === 'approved') ?? null;

  return {
    propertyId,
    leases: propertyLeases,
    rents: propertyRents,
    utilities: propertyUtilities,
    activeLease,
    leaseGroups,
  };
}

export function summarizePropertyRecords(bundle: PropertyRecordsBundle): PropertyRecordSnapshot {
  const activeGroup = bundle.activeLease
    ? bundle.leaseGroups.find((g) => g.lease.id === bundle.activeLease!.id) ?? {
        lease: bundle.activeLease,
        rents: bundle.rents.filter((r) => r.lease_application_id === bundle.activeLease!.id),
      }
    : bundle.leaseGroups[0] ?? null;

  const tenantPeriods = activeGroup
    ? buildTenantPeriods(activeGroup.lease, activeGroup.rents)
    : [];
  const payoutPeriods = activeGroup
    ? buildPayoutPeriods(activeGroup.lease, activeGroup.rents)
    : [];

  const nextTenant = pickNextTenantDue(tenantPeriods);
  const lastTenant = pickLastTenantPaid(tenantPeriods);
  const nextPayout = pickNextPayoutDue(payoutPeriods);
  const lastPayout = pickLastPayoutPaid(payoutPeriods);
  const nextUtil = pickNextUtilityDue(bundle.utilities);
  const lastUtil = pickLastUtility(bundle.utilities);

  return {
    tenantNext: nextTenant ? `${nextTenant.label} · ${nextTenant.dueDate}` : null,
    tenantLast: lastTenant
      ? `${lastTenant.label}${lastTenant.paidAt ? ` · ${lastTenant.paidAt.slice(0, 10)}` : ''}`
      : null,
    utilityNext: nextUtil?.month ?? null,
    utilityLast: lastUtil ? billMonthLabel(lastUtil.bill_month) : null,
    payoutNext: nextPayout?.label ?? null,
    payoutLast: lastPayout
      ? `${lastPayout.label}${lastPayout.landlordPaidAt ? ` · ${lastPayout.landlordPaidAt.slice(0, 10)}` : ''}`
      : null,
  };
}
