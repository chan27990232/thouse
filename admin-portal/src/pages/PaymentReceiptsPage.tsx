import { useCallback, useEffect, useMemo, useState } from 'react';
import { utilityBillTypeLabel } from '../lib/propertyRecords';
import { supabase } from '../lib/supabase';

type PaymentKind = 'lease_initial' | 'monthly_rent' | 'utility';

type PaymentRow = {
  id: string;
  kind: PaymentKind;
  createdAt: string;
  tenantName: string;
  tenantEmail: string;
  propertyTitle: string;
  amount: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  receiptUrl: string | null;
  status: string;
  paidAt: string | null;
  dueDate: string | null;
  periodIndex: number | null;
  billMonth: string | null;
  billType: string | null;
};

const KIND_LABEL: Record<PaymentKind, string> = {
  lease_initial: '簽約首期',
  monthly_rent: '每月租金',
  utility: '水電煤',
};

const STATUS_LABEL: Record<string, string> = {
  succeeded: '已記帳',
  pending_bank: '待入數核對',
  paid: '已支付',
  pending: '待繳',
  overdue: '逾期',
  failed: '失敗',
};

function receiptLink(url: string | null | undefined) {
  const u = (url ?? '').trim();
  if (!u) return <span className="muted">—</span>;
  return (
    <a href={u} target="_blank" rel="noopener noreferrer">
      查看收據
    </a>
  );
}

function methodLabel(m: string | null) {
  if (m === 'fps') return '轉數快';
  if (m === 'bank_transfer') return '銀行轉賬';
  if (m === 'card') return '信用卡';
  return m ?? '—';
}

export function PaymentReceiptsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | PaymentKind>('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const merged: PaymentRow[] = [];

    const [leaseRes, rentRes, utilityRes] = await Promise.all([
      supabase
        .from('lease_applications')
        .select(
          `id, created_at, full_name, email, first_payment_total, payment_method, payment_reference, bank_transfer_receipt_url, payment_status, paid_at,
           properties ( title ),
           tenant:profiles!lease_applications_tenant_id_fkey ( full_name, email )`
        )
        .not('payment_method', 'is', null)
        .order('created_at', { ascending: false })
        .limit(400),
      supabase
        .from('rent_payments')
        .select(
          `id, created_at, period_index, due_date, amount, status, payment_method, payment_reference, bank_transfer_receipt_url, paid_at,
           properties ( title ),
           tenant:profiles!rent_payments_tenant_id_fkey ( full_name, email )`
        )
        .order('created_at', { ascending: false })
        .limit(400),
      supabase
        .from('tenant_utility_obligations')
        .select(
          `id, created_at, bill_month, bill_type, due_date, amount, status, payment_method, payment_reference, bank_transfer_receipt_url, paid_at,
           properties ( title ),
           tenant:profiles!tenant_utility_obligations_tenant_id_fkey ( full_name, email )`
        )
        .order('created_at', { ascending: false })
        .limit(400),
    ]);

    if (leaseRes.error) {
      setErr(leaseRes.error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    if (rentRes.error) {
      setErr((prev) => (prev ? `${prev}；` : '') + rentRes.error.message);
    }
    if (utilityRes.error) {
      setErr((prev) => (prev ? `${prev}；` : '') + utilityRes.error.message);
    }

    for (const r of leaseRes.data ?? []) {
      const raw = r as Record<string, unknown>;
      const props = raw.properties as { title?: string } | { title?: string }[] | null;
      const tenant = raw.tenant as { full_name?: string; email?: string } | null;
      const title = Array.isArray(props) ? props[0]?.title : props?.title;
      merged.push({
        id: String(raw.id),
        kind: 'lease_initial',
        createdAt: String(raw.created_at ?? ''),
        tenantName: (raw.full_name as string)?.trim() || tenant?.full_name?.trim() || '—',
        tenantEmail: (raw.email as string)?.trim() || tenant?.email?.trim() || '—',
        propertyTitle: title?.trim() || '—',
        amount: Number(raw.first_payment_total) || 0,
        paymentMethod: (raw.payment_method as string) ?? null,
        paymentReference: (raw.payment_reference as string) ?? null,
        receiptUrl: (raw.bank_transfer_receipt_url as string) ?? null,
        status: (raw.payment_status as string) ?? '—',
        paidAt: (raw.paid_at as string) ?? null,
        dueDate: null,
        periodIndex: null,
        billMonth: null,
        billType: null,
      });
    }

    for (const r of rentRes.data ?? []) {
      const raw = r as Record<string, unknown>;
      const props = raw.properties as { title?: string } | { title?: string }[] | null;
      const tenant = raw.tenant as { full_name?: string; email?: string } | null;
      const title = Array.isArray(props) ? props[0]?.title : props?.title;
      merged.push({
        id: String(raw.id),
        kind: 'monthly_rent',
        createdAt: String(raw.created_at ?? ''),
        tenantName: tenant?.full_name?.trim() || '—',
        tenantEmail: tenant?.email?.trim() || '—',
        propertyTitle: title?.trim() || '—',
        amount: Number(raw.amount) || 0,
        paymentMethod: (raw.payment_method as string) ?? null,
        paymentReference: (raw.payment_reference as string) ?? null,
        receiptUrl: (raw.bank_transfer_receipt_url as string) ?? null,
        status: (raw.status as string) ?? '—',
        paidAt: (raw.paid_at as string) ?? null,
        dueDate: (raw.due_date as string) ?? null,
        periodIndex: Number(raw.period_index) || null,
        billMonth: null,
        billType: null,
      });
    }

    for (const r of utilityRes.data ?? []) {
      const raw = r as Record<string, unknown>;
      const props = raw.properties as { title?: string } | { title?: string }[] | null;
      const tenant = raw.tenant as { full_name?: string; email?: string } | null;
      const title = Array.isArray(props) ? props[0]?.title : props?.title;
      const billMonth = String(raw.bill_month ?? '').slice(0, 7) || null;
      merged.push({
        id: String(raw.id),
        kind: 'utility',
        createdAt: String(raw.created_at ?? ''),
        tenantName: tenant?.full_name?.trim() || '—',
        tenantEmail: tenant?.email?.trim() || '—',
        propertyTitle: title?.trim() || '—',
        amount: Number(raw.amount) || 0,
        paymentMethod: (raw.payment_method as string) ?? null,
        paymentReference: (raw.payment_reference as string) ?? null,
        receiptUrl: (raw.bank_transfer_receipt_url as string) ?? null,
        status: (raw.status as string) ?? '—',
        paidAt: (raw.paid_at as string) ?? null,
        dueDate: (raw.due_date as string) ?? null,
        periodIndex: null,
        billMonth,
        billType: (raw.bill_type as string) ?? null,
      });
    }

    merged.sort((a, b) => {
      const at = a.paidAt || a.createdAt;
      const bt = b.paidAt || b.createdAt;
      return at < bt ? 1 : -1;
    });
    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!kindFilter) return rows;
    return rows.filter((r) => r.kind === kindFilter);
  }, [rows, kindFilter]);

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>付款收據</h1>
      <p className="muted">記錄所有租客付款（簽約首期、每月租金及水電煤），含轉賬證明連結。</p>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="muted">類型</span>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as '' | PaymentKind)} style={{ minWidth: '140px' }}>
          <option value="">全部</option>
          <option value="lease_initial">簽約首期</option>
          <option value="monthly_rent">每月租金</option>
          <option value="utility">水電煤</option>
        </select>
        <button type="button" className="btn" onClick={() => void load()}>
          重新整理
        </button>
      </div>

      {err && <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{err}</p>}
      {loading ? (
        <p className="muted">載入中…</p>
      ) : (
        <div className="table-wrap card" style={{ padding: 0, marginTop: '1rem' }}>
          <table className="data">
            <thead>
              <tr>
                <th>時間</th>
                <th>類型</th>
                <th>租客</th>
                <th>物業</th>
                <th>金額</th>
                <th>方式</th>
                <th>狀態</th>
                <th>收據</th>
                <th>參考編號</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted" style={{ padding: '1.5rem' }}>
                    尚無付款紀錄
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={`${r.kind}-${r.id}`}>
                  <td className="muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {r.paidAt?.slice(0, 16).replace('T', ' ') || r.createdAt?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td>
                    {KIND_LABEL[r.kind]}
                    {r.periodIndex ? (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          第 {r.periodIndex} 期
                          {r.dueDate ? ` · 到期 ${r.dueDate}` : ''}
                        </span>
                      </>
                    ) : null}
                    {r.billMonth ? (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          {r.billMonth}
                          {r.billType && r.billType !== 'legacy'
                            ? ` · ${utilityBillTypeLabel(r.billType)}`
                            : ''}
                          {r.dueDate ? ` · 到期 ${r.dueDate}` : ''}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {r.tenantEmail}
                    <br />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      {r.tenantName}
                    </span>
                  </td>
                  <td>{r.propertyTitle}</td>
                  <td>
                    HK$
                    {r.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>{methodLabel(r.paymentMethod)}</td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td>{receiptLink(r.receiptUrl)}</td>
                  <td className="muted" style={{ fontSize: '0.75rem', maxWidth: '120px', wordBreak: 'break-all' }}>
                    {r.paymentReference ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
