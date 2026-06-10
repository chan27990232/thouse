import type { ReactNode } from 'react';
import {
  type LeaseRecord,
  type RentRecord,
  type UtilityObligationRecord,
  buildPayoutPeriods,
  buildTenantPeriods,
  buildUtilityPaymentPeriods,
  formatRentPeriodLabel,
  formatUtilityObligationLabel,
  pickLastPayoutPaid,
  pickLastTenantPaid,
  pickLastUtilityPaymentPaid,
  pickNextPayoutDue,
  pickNextTenantDue,
  pickNextUtilityPaymentDue,
} from '../lib/propertyRecords';

const TENANT_PAY_LABEL: Record<string, string> = {
  succeeded: '已記帳',
  pending_bank: '待入數核對',
  failed: '失敗',
  paid: '已支付',
  pending: '待繳',
  overdue: '逾期',
};

const PAYOUT_LABEL: Record<string, string> = {
  pending: '待轉交',
  processing: '處理中',
  paid: '已轉交業主',
};

const LEASE_STATUS_LABEL: Record<string, string> = {
  awaiting_platform_1: '待平台初審',
  awaiting_landlord: '待業主回覆',
  awaiting_platform_2: '待平台複審',
  approved: '已核准',
  rejected: '已駁回',
};

function methodLabel(m: string | null) {
  if (m === 'fps') return '轉數快';
  if (m === 'bank_transfer') return '銀行轉賬';
  if (m === 'card') return '信用卡';
  return m ?? '—';
}

function receiptLink(url: string | null | undefined) {
  const u = (url ?? '').trim();
  if (!u) return <span className="muted">—</span>;
  return (
    <a href={u} target="_blank" rel="noopener noreferrer">
      查看
    </a>
  );
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return iso.slice(0, 16).replace('T', ' ');
}

function RecordSummary({
  nextLabel,
  nextContent,
  lastLabel,
  lastContent,
}: {
  nextLabel: string;
  nextContent: ReactNode;
  lastLabel: string;
  lastContent: ReactNode;
}) {
  return (
    <div className="record-summary-row">
      <div className="record-summary-box record-summary-box--next">
        <div className="record-summary-label">{nextLabel}</div>
        {nextContent}
      </div>
      <div className="record-summary-box record-summary-box--last">
        <div className="record-summary-label">{lastLabel}</div>
        {lastContent}
      </div>
    </div>
  );
}

type Props = {
  propertyTitle: string;
  lease: LeaseRecord;
  rents: RentRecord[];
  utilityObligations?: UtilityObligationRecord[];
  isActive: boolean;
  savingPayout: string | null;
  onLeasePayout: (leaseId: string, status: string) => void;
  onRentPayout: (rentId: string, status: string) => void;
  onUtilityPayout: (utilityId: string, status: string) => void;
  showPayoutSummary?: boolean;
};

export function PropertyLeaseRecordBlock({
  propertyTitle,
  lease,
  rents,
  utilityObligations = [],
  isActive,
  savingPayout,
  onLeasePayout,
  onRentPayout,
  onUtilityPayout,
  showPayoutSummary = false,
}: Props) {
  const tenantPeriods = buildTenantPeriods(lease, rents);
  const utilityPeriods = buildUtilityPaymentPeriods(utilityObligations);
  const payoutPeriods = buildPayoutPeriods(lease, rents, utilityObligations);
  const nextTenantDue = pickNextTenantDue(tenantPeriods) ?? pickNextUtilityPaymentDue(utilityPeriods);
  const lastTenantPaid = pickLastTenantPaid(tenantPeriods) ?? pickLastUtilityPaymentPaid(utilityPeriods);
  const nextPayoutDue = pickNextPayoutDue(payoutPeriods);
  const lastPayoutPaid = pickLastPayoutPaid(payoutPeriods);
  const nextRentRowKey =
    pickNextTenantDue(tenantPeriods)?.rowKey ?? pickLastTenantPaid(tenantPeriods)?.rowKey ?? null;
  const lastRentRowKey = pickLastTenantPaid(tenantPeriods)?.rowKey ?? null;
  const nextUtilityRowKey = pickNextUtilityPaymentDue(utilityPeriods)?.rowKey ?? null;
  const lastUtilityRowKey = pickLastUtilityPaymentPaid(utilityPeriods)?.rowKey ?? null;

  function tenantRowClass(rowKey: string) {
    const classes: string[] = [];
    if (rowKey === nextRentRowKey || rowKey === nextUtilityRowKey) classes.push('data-row--highlight-next');
    if (
      (rowKey === lastRentRowKey && rowKey !== nextRentRowKey) ||
      (rowKey === lastUtilityRowKey && rowKey !== nextUtilityRowKey)
    ) {
      classes.push('data-row--highlight-last');
    }
    return classes.join(' ');
  }

  const hasInitial =
    lease.payment_method || lease.payment_status || lease.paid_at;
  const hasRentRows = hasInitial || rents.length > 0;
  const hasUtilityRows = utilityObligations.length > 0;
  const hasRows = hasRentRows || hasUtilityRows;

  return (
    <div className={`property-lease-block ${isActive ? 'property-lease-block--active' : ''}`}>
      <div className="property-lease-block-head">
        <div>
          <strong>{isActive ? '現時租約' : '歷史租約'}</strong>
          <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
            {lease.full_name} · {LEASE_STATUS_LABEL[lease.status] ?? lease.status}
          </span>
        </div>
        <span className="muted" style={{ fontSize: '0.72rem' }}>
          租盤：{propertyTitle}
        </span>
      </div>

      <RecordSummary
        nextLabel="最近要交"
        nextContent={
          nextTenantDue ? (
            <>
              <strong>{nextTenantDue.label}</strong>
              <div>
                到期 {nextTenantDue.dueDate} · HK${nextTenantDue.amount.toLocaleString()}
              </div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                {TENANT_PAY_LABEL[nextTenantDue.tenantStatus] ?? nextTenantDue.tenantStatus}
              </div>
            </>
          ) : (
            <span className="record-summary-empty">無待繳紀錄</span>
          )
        }
        lastLabel="上次最新已交"
        lastContent={
          lastTenantPaid ? (
            <>
              <strong>{lastTenantPaid.label}</strong>
              <div>
                HK${lastTenantPaid.amount.toLocaleString()}
                {lastTenantPaid.paidAt ? ` · ${fmt(lastTenantPaid.paidAt)}` : ''}
              </div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                {TENANT_PAY_LABEL[lastTenantPaid.tenantStatus] ?? lastTenantPaid.tenantStatus}
              </div>
            </>
          ) : (
            <span className="record-summary-empty">尚無已付紀錄</span>
          )
        }
      />

      {showPayoutSummary ? (
        <RecordSummary
          nextLabel="最近要交（轉交業主）"
          nextContent={
            nextPayoutDue ? (
              <>
                <strong>{nextPayoutDue.label}</strong>
                <div>HK${nextPayoutDue.amount.toLocaleString()}</div>
                <div className="muted" style={{ fontSize: '0.78rem' }}>
                  {PAYOUT_LABEL[nextPayoutDue.payoutStatus] ?? nextPayoutDue.payoutStatus}
                  <span> · 租客已付</span>
                </div>
              </>
            ) : (
              <span className="record-summary-empty">無待轉交紀錄</span>
            )
          }
          lastLabel="上次最新已交"
          lastContent={
            lastPayoutPaid ? (
              <>
                <strong>{lastPayoutPaid.label}</strong>
                <div>
                  HK${lastPayoutPaid.amount.toLocaleString()}
                  {lastPayoutPaid.landlordPaidAt ? ` · ${fmt(lastPayoutPaid.landlordPaidAt)}` : ''}
                </div>
                <div className="muted" style={{ fontSize: '0.78rem' }}>
                  {PAYOUT_LABEL.paid}
                </div>
              </>
            ) : (
              <span className="record-summary-empty">尚無轉交紀錄</span>
            )
          }
        />
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>帳項</th>
              <th>到期日</th>
              <th>金額</th>
              <th>租客付款</th>
              <th>方式</th>
              <th>收據</th>
              <th>公司轉業主</th>
            </tr>
          </thead>
          <tbody>
            {!hasRows ? (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: '1.25rem' }}>
                  此租約尚無付款紀錄
                </td>
              </tr>
            ) : null}
            {hasInitial ? (
              <tr className={tenantRowClass(`lease-${lease.id}`)}>
                <td>{formatRentPeriodLabel(lease.move_in_date, 'initial')}</td>
                <td>{lease.move_in_date ?? '—'}</td>
                <td>HK${lease.first_payment_total?.toLocaleString()}</td>
                <td>{TENANT_PAY_LABEL[lease.payment_status ?? ''] ?? lease.payment_status ?? '—'}</td>
                <td>{methodLabel(lease.payment_method)}</td>
                <td>{receiptLink(lease.bank_transfer_receipt_url)}</td>
                <td>
                  <select
                    value={lease.landlord_payout_status ?? 'pending'}
                    disabled={savingPayout === `lease-${lease.id}`}
                    onChange={(e) => onLeasePayout(lease.id, e.target.value)}
                    style={{ fontSize: '0.8rem', minWidth: '7.5rem' }}
                  >
                    <option value="pending">待轉交</option>
                    <option value="processing">處理中</option>
                    <option value="paid">已轉交業主</option>
                  </select>
                  {lease.landlord_paid_at ? (
                    <div className="muted" style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>
                      {fmt(lease.landlord_paid_at)}
                    </div>
                  ) : null}
                </td>
              </tr>
            ) : null}
            {rents.map((r) => (
              <tr key={r.id} className={tenantRowClass(`rent-${r.id}`)}>
                <td>{formatRentPeriodLabel(lease.move_in_date, r.period_index)}</td>
                <td>{r.due_date}</td>
                <td>HK${r.amount?.toLocaleString()}</td>
                <td>{TENANT_PAY_LABEL[r.status] ?? r.status}</td>
                <td>{methodLabel(r.payment_method)}</td>
                <td>{receiptLink(r.bank_transfer_receipt_url)}</td>
                <td>
                  <select
                    value={r.landlord_payout_status ?? 'pending'}
                    disabled={savingPayout === `rent-${r.id}`}
                    onChange={(e) => onRentPayout(r.id, e.target.value)}
                    style={{ fontSize: '0.8rem', minWidth: '7.5rem' }}
                  >
                    <option value="pending">待轉交</option>
                    <option value="processing">處理中</option>
                    <option value="paid">已轉交業主</option>
                  </select>
                  {r.landlord_paid_at ? (
                    <div className="muted" style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>
                      {fmt(r.landlord_paid_at)}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {utilityObligations.map((u) => (
              <tr key={u.id} className={tenantRowClass(`utility-${u.id}`)}>
                <td>{formatUtilityObligationLabel(u)}</td>
                <td>{u.due_date}</td>
                <td>
                  HK$
                  {Number(u.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td>{TENANT_PAY_LABEL[u.status] ?? u.status}</td>
                <td>{methodLabel(u.payment_method)}</td>
                <td>{receiptLink(u.bank_transfer_receipt_url)}</td>
                <td>
                  <select
                    value={u.landlord_payout_status ?? 'pending'}
                    disabled={savingPayout === `utility-${u.id}`}
                    onChange={(e) => onUtilityPayout(u.id, e.target.value)}
                    style={{ fontSize: '0.8rem', minWidth: '7.5rem' }}
                  >
                    <option value="pending">待轉交</option>
                    <option value="processing">處理中</option>
                    <option value="paid">已轉交業主</option>
                  </select>
                  {u.landlord_paid_at ? (
                    <div className="muted" style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>
                      {fmt(u.landlord_paid_at)}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
