import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/** 對應主站 leaseApplications LeaseWorkflowStatus */
const STATUS_LABEL: Record<string, string> = {
  awaiting_platform_1: '待平台一審',
  awaiting_landlord: '待業主確認',
  awaiting_platform_2: '待平台複審',
  approved: '已核准',
  rejected: '已拒絕',
};

function statusBadgeClass(status: string) {
  switch (status) {
    case 'awaiting_platform_1':
      return 'draft';
    case 'awaiting_landlord':
      return 'inactive';
    case 'awaiting_platform_2':
      return 'review2';
    case 'approved':
      return 'open';
    case 'rejected':
      return 'closed';
    default:
      return 'inactive';
  }
}

type LeaseRow = {
  id: string;
  created_at: string;
  status: string;
  full_name: string;
  email: string;
  phone: string;
  first_payment_total: number;
  payment_method: string | null;
  payment_reference: string | null;
  bank_transfer_receipt_url: string | null;
  property_id: string;
  landlord_id: string;
  tenant_id: string;
  properties: { title: string | null } | { title: string | null }[] | null;
};

function titleOf(r: LeaseRow) {
  const p = r.properties;
  if (Array.isArray(p)) return p[0]?.title?.trim() || '—';
  return p?.title?.trim() || '—';
}

function receiptCell(url: string | null | undefined) {
  const u = (url ?? '').trim();
  if (!u) return <span className="muted">—</span>;
  return (
    <a href={u} target="_blank" rel="noopener noreferrer">
      查看證明
    </a>
  );
}

export function LeaseApplicationsPage() {
  const location = useLocation();
  const [rows, setRows] = useState<LeaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const { data: raw, error } = await supabase
      .from('lease_applications')
      .select(
        'id, created_at, status, full_name, email, phone, first_payment_total, payment_method, payment_reference, bank_transfer_receipt_url, property_id, landlord_id, tenant_id, properties ( title )'
      )
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(((raw ?? []) as unknown) as LeaseRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (location.pathname !== '/leases') return;
    void load();
  }, [location.pathname, location.key, load]);

  async function platformReview(applicationId: string, stage: 1 | 2, approve: boolean) {
    setActionId(applicationId);
    setErr('');
    const { error: rErr } = await supabase.rpc('platform_review_lease_application', {
      p_application_id: applicationId,
      p_stage: stage,
      p_approve: approve,
    });
    setActionId(null);
    if (rErr) {
      setErr(rErr.message || '操作失敗');
      return;
    }
    await load();
  }

  const stage1Rows = rows.filter((r) => r.status === 'awaiting_platform_1');
  const stage2Rows = rows.filter((r) => r.status === 'awaiting_platform_2');

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>租約申請（平台審核）</h1>
      <p className="muted" style={{ marginBottom: '1.25rem' }}>
        <strong>一審：</strong>
        租客剛提交的申請。通過後才會對業主顯示「待業主確認」。<strong>複審：</strong>
        業主同意後再由平台確認；通過會將該租盤標為已租並結案其他並行管道申請。
      </p>

      {err ? (
        <p style={{ color: '#f85149', marginBottom: '1rem' }} role="alert">
          {err}
        </p>
      ) : null}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>待你一審（{stage1Rows.length}）</h2>
        {loading ? (
          <p className="muted">載入中…</p>
        ) : stage1Rows.length === 0 ? (
          <p className="muted">目前沒有需要一審的申請</p>
        ) : (
          <div className="table-wrap card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%', minWidth: 720 }}>
              <thead>
                <tr>
                  <th>申請時間</th>
                  <th>租盤</th>
                  <th>申請人</th>
                  <th>首期</th>
                  <th>轉賬證明</th>
                  <th>狀態</th>
                  <th style={{ minWidth: 180 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {stage1Rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString('zh-HK')}
                    </td>
                    <td>{titleOf(r)}</td>
                    <td>
                      <div>{r.full_name}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        {r.email}
                      </div>
                    </td>
                    <td>HK${Number(r.first_payment_total).toLocaleString()}</td>
                    <td>{receiptCell(r.bank_transfer_receipt_url)}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(r.status)}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionId !== null}
                        onClick={() => void platformReview(r.id, 1, true)}
                      >
                        通過一審
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={actionId !== null}
                        onClick={() => void platformReview(r.id, 1, false)}
                      >
                        拒絕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>待你複審（{stage2Rows.length}）</h2>
        {loading ? null : stage2Rows.length === 0 ? (
          <p className="muted">目前沒有需要複審的申請</p>
        ) : (
          <div className="table-wrap card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%', minWidth: 720 }}>
              <thead>
                <tr>
                  <th>申請時間</th>
                  <th>租盤</th>
                  <th>申請人</th>
                  <th>首期</th>
                  <th>轉賬證明</th>
                  <th>狀態</th>
                  <th style={{ minWidth: 180 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {stage2Rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString('zh-HK')}
                    </td>
                    <td>{titleOf(r)}</td>
                    <td>
                      <div>{r.full_name}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        {r.email}
                      </div>
                    </td>
                    <td>HK${Number(r.first_payment_total).toLocaleString()}</td>
                    <td>{receiptCell(r.bank_transfer_receipt_url)}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(r.status)}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionId !== null}
                        onClick={() => void platformReview(r.id, 2, true)}
                      >
                        通過並結案
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={actionId !== null}
                        onClick={() => void platformReview(r.id, 2, false)}
                      >
                        拒絕收案
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted" style={{ marginTop: '1.5rem' }}>
        其餘狀態（待業主、已結案）請用主站對應控制台查看完整列表如需除錯，可改用 SQL 監查。
      </p>
    </div>
  );
}
