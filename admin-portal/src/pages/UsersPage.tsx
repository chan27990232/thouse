import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Row = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string;
  is_verified: boolean;
  created_at: string;
  landlord_verification_status: string | null;
  landlord_verification_rejection_reason: string | null;
  landlord_verification_submitted_at: string | null;
  tenant_verification_status: string | null;
  tenant_verification_rejection_reason: string | null;
  tenant_verification_submitted_at: string | null;
};

type Rejecting = { id: string; reason: string; kind: 'landlord' | 'tenant' };

function verLabel(
  r: Row,
  which: 'landlord' | 'tenant',
): { text: string; title?: string } {
  if (r.role !== which) return { text: '—' };
  const v = which === 'landlord' ? (r.landlord_verification_status ?? 'none') : (r.tenant_verification_status ?? 'none');
  const reason =
    which === 'landlord' ? r.landlord_verification_rejection_reason : r.tenant_verification_rejection_reason;
  if (r.is_verified) return { text: '已通過' };
  if (v === 'pending') return { text: '待審' };
  if (v === 'rejected') return { text: '已駁回', title: reason || undefined };
  return { text: '未申請' };
}

export function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState<Rejecting | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, role, phone, is_verified, created_at, landlord_verification_status, landlord_verification_rejection_reason, landlord_verification_submitted_at, tenant_verification_status, tenant_verification_rejection_reason, tenant_verification_submitted_at',
      )
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const approve = async (id: string, kind: 'landlord' | 'tenant') => {
    setActionError('');
    setVerifying(true);
    try {
      const base = {
        is_verified: true,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;
      if (kind === 'landlord') {
        Object.assign(base, {
          landlord_verification_status: 'none',
          landlord_verification_rejection_reason: '',
          landlord_verification_submitted_at: null,
        });
      } else {
        Object.assign(base, {
          tenant_verification_status: 'none',
          tenant_verification_rejection_reason: '',
          tenant_verification_submitted_at: null,
        });
      }
      const { error } = await supabase
        .from('profiles')
        .update(base)
        .eq('id', id)
        .eq('role', kind === 'landlord' ? 'landlord' : 'tenant');
      if (error) throw new Error(error.message);
      await loadRows();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '核准失敗');
    } finally {
      setVerifying(false);
    }
  };

  const runReject = async () => {
    if (!rejecting) return;
    const reason = rejecting.reason.trim();
    if (!reason) {
      setActionError('請填寫駁回原因。');
      return;
    }
    setActionError('');
    setVerifying(true);
    const kind = rejecting.kind;
    try {
      const base = {
        is_verified: false,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;
      if (kind === 'landlord') {
        Object.assign(base, {
          landlord_verification_status: 'rejected',
          landlord_verification_rejection_reason: reason,
        });
      } else {
        Object.assign(base, {
          tenant_verification_status: 'rejected',
          tenant_verification_rejection_reason: reason,
        });
      }
      const { error } = await supabase
        .from('profiles')
        .update(base)
        .eq('id', rejecting.id)
        .eq('role', kind === 'landlord' ? 'landlord' : 'tenant');
      if (error) throw new Error(error.message);
      setRejecting(null);
      await loadRows();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '駁回失敗');
    } finally {
      setVerifying(false);
    }
  };

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      r.email.toLowerCase().includes(t) ||
      (r.full_name && r.full_name.toLowerCase().includes(t)) ||
      r.id.toLowerCase().includes(t)
    );
  });

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>用戶</h1>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        讀取 profiles（RLS：管理員專用）。實名驗證：業主或租客狀態為「待審」時可核准或駁回（須已套用 <code>landlord_verification.sql</code> 與{' '}
        <code>tenant_verification.sql</code>）。
      </p>
      {actionError ? (
        <p style={{ color: 'crimson', marginBottom: '0.75rem' }}>{actionError}</p>
      ) : null}
      {rejecting ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
            駁回{rejecting.kind === 'landlord' ? '業主' : '租客'}驗證
          </p>
          <textarea
            value={rejecting.reason}
            onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
            rows={3}
            placeholder="請輸入駁回原因（用戶端會看見）"
            style={{ width: '100%', maxWidth: '480px', marginBottom: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary" disabled={verifying} onClick={() => void runReject()}>
              確認駁回
            </button>
            <button type="button" className="btn" disabled={verifying} onClick={() => setRejecting(null)}>
              取消
            </button>
          </div>
        </div>
      ) : null}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="搜尋…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', maxWidth: '320px' }}
        />
      </div>
      {loading ? (
        <p className="muted">載入中…</p>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Email</th>
                <th>姓名</th>
                <th>身份</th>
                <th>業主審核</th>
                <th>租客審核</th>
                <th>認證</th>
                <th>註冊</th>
                <th>操作</th>
                <th>UUID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const lv = verLabel(r, 'landlord');
                const tv = verLabel(r, 'tenant');
                const lPending = r.role === 'landlord' && (r.landlord_verification_status ?? 'none') === 'pending' && !r.is_verified;
                const tPending = r.role === 'tenant' && (r.tenant_verification_status ?? 'none') === 'pending' && !r.is_verified;
                return (
                  <tr key={r.id}>
                    <td>{r.email}</td>
                    <td>{r.full_name || '—'}</td>
                    <td>{r.role}</td>
                    <td>
                      {r.role === 'landlord' ? (
                        <span className="muted" title={lv.title}>
                          {lv.text}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {r.role === 'tenant' ? (
                        <span className="muted" title={tv.title}>
                          {tv.text}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{r.is_verified ? '是' : '否'}</td>
                    <td className="muted">{r.created_at?.slice(0, 10)}</td>
                    <td>
                      {lPending ? (
                        <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.8rem' }}
                            disabled={verifying}
                            onClick={() => void approve(r.id, 'landlord')}
                          >
                            核准(業主)
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.8rem' }}
                            disabled={verifying}
                            onClick={() => setRejecting({ id: r.id, reason: '', kind: 'landlord' })}
                          >
                            駁回(業主)
                          </button>
                        </span>
                      ) : tPending ? (
                        <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.8rem' }}
                            disabled={verifying}
                            onClick={() => void approve(r.id, 'tenant')}
                          >
                            核准(租客)
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.8rem' }}
                            disabled={verifying}
                            onClick={() => setRejecting({ id: r.id, reason: '', kind: 'tenant' })}
                          >
                            駁回(租客)
                          </button>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: '0.7rem' }}>
                      {r.id}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted" style={{ padding: '0.75rem 1rem' }}>
            顯示 {filtered.length} / {rows.length} 筆
          </p>
        </div>
      )}
    </div>
  );
}
