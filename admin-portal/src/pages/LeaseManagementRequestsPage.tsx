import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const REQUEST_TYPE_LABEL: Record<string, string> = {
  early_end: '提早結束租約',
  renew: '續約',
  breach: '違約',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待審核',
  approved: '已核准',
  rejected: '已駁回',
};

type RequestFileRow = {
  id: string;
  request_id: string;
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
};

type RequestRow = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  notes: string;
  renewal_months: number | null;
  early_end_date: string | null;
  admin_notes: string;
  lease_application_id: string;
  properties: { title: string | null } | { title: string | null }[] | null;
  lease_applications:
    | { full_name: string; email: string; phone: string }
    | { full_name: string; email: string; phone: string }[]
    | null;
  files?: RequestFileRow[];
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function titleOf(r: RequestRow) {
  const p = r.properties;
  if (Array.isArray(p)) return p[0]?.title?.trim() || '—';
  return p?.title?.trim() || '—';
}

function tenantOf(r: RequestRow) {
  const la = r.lease_applications;
  if (Array.isArray(la)) return la[0];
  return la;
}

function detailOf(r: RequestRow) {
  if (r.request_type === 'renew') {
    return `延長 ${r.renewal_months ?? '—'} 個月`;
  }
  if (r.request_type === 'early_end') {
    return r.early_end_date
      ? `結束日 ${new Date(r.early_end_date + 'T12:00:00').toLocaleDateString('zh-HK')}`
      : '—';
  }
  return '—';
}

export function LeaseManagementRequestsPage() {
  const location = useLocation();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [openingFile, setOpeningFile] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const { data: raw, error } = await supabase
      .from('lease_management_requests')
      .select(
        `
        id, created_at, status, request_type, notes, renewal_months, early_end_date, admin_notes, lease_application_id,
        properties ( title ),
        lease_applications ( full_name, email, phone )
      `
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (raw ?? []) as unknown as RequestRow[];
    const ids = list.map((r) => r.id);
    let filesByRequest = new Map<string, RequestFileRow[]>();

    if (ids.length > 0) {
      const { data: fileRows, error: fileErr } = await supabase
        .from('lease_management_request_files')
        .select('id, request_id, file_name, storage_path, file_size_bytes')
        .in('request_id', ids)
        .order('created_at', { ascending: true });

      if (fileErr && !fileErr.message.includes('lease_management_request_files')) {
        setErr(fileErr.message);
      } else {
        filesByRequest = new Map();
        for (const f of fileRows ?? []) {
          const rid = f.request_id as string;
          const arr = filesByRequest.get(rid) ?? [];
          arr.push({
            id: f.id as string,
            request_id: rid,
            file_name: f.file_name as string,
            storage_path: f.storage_path as string,
            file_size_bytes: Number(f.file_size_bytes),
          });
          filesByRequest.set(rid, arr);
        }
      }
    }

    setRows(list.map((r) => ({ ...r, files: filesByRequest.get(r.id) ?? [] })));
    setLoading(false);
  }, []);

  async function openAttachment(storagePath: string) {
    setOpeningFile(storagePath);
    setErr('');
    const { data, error } = await supabase.storage
      .from('lease-management-requests')
      .createSignedUrl(storagePath, 3600);
    setOpeningFile(null);
    if (error || !data?.signedUrl) {
      setErr(error?.message || '無法取得下載連結');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  useEffect(() => {
    if (location.pathname !== '/lease-changes') return;
    void load();
  }, [location.pathname, location.key, load]);

  async function review(requestId: string, approve: boolean) {
    setActionId(requestId);
    setErr('');
    const { error: rErr } = await supabase.rpc('admin_review_lease_management_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_admin_notes: '',
    });
    setActionId(null);
    if (rErr) {
      setErr(rErr.message || '操作失敗');
      return;
    }
    await load();
  }

  const pendingRows = rows.filter((r) => r.status === 'pending');

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>租約變更申請（業主）</h1>
      <p className="muted" style={{ marginBottom: '1.25rem' }}>
        業主提交的提早結束、續約或違約申請。<strong>核准後</strong>才會更新租約狀態；駁回則維持現有租約。
      </p>

      {err ? (
        <p style={{ color: '#f85149', marginBottom: '1rem' }} role="alert">
          {err}
        </p>
      ) : null}

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>待審核（{pendingRows.length}）</h2>
        {loading ? (
          <p className="muted">載入中…</p>
        ) : pendingRows.length === 0 ? (
          <p className="muted">目前沒有待審核的租約變更申請</p>
        ) : (
          <div className="table-wrap card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%', minWidth: 880 }}>
              <thead>
                <tr>
                  <th>申請時間</th>
                  <th>類型</th>
                  <th>租盤</th>
                  <th>租客</th>
                  <th>內容</th>
                  <th>業主說明</th>
                  <th>附件</th>
                  <th style={{ minWidth: 180 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((r) => {
                  const tenant = tenantOf(r);
                  return (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleString('zh-HK')}
                      </td>
                      <td>{REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type}</td>
                      <td>{titleOf(r)}</td>
                      <td>
                        <div>{tenant?.full_name ?? '—'}</div>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>
                          {tenant?.email ?? ''}
                        </div>
                      </td>
                      <td>{detailOf(r)}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'pre-wrap' }}>{r.notes || '—'}</td>
                      <td style={{ maxWidth: 180 }}>
                        {(r.files?.length ?? 0) === 0 ? (
                          '—'
                        ) : (
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {r.files!.map((f) => (
                              <li key={f.id} style={{ marginBottom: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                                  disabled={openingFile !== null}
                                  onClick={() => void openAttachment(f.storage_path)}
                                >
                                  {openingFile === f.storage_path ? '開啟中…' : f.file_name}
                                </button>
                                <span className="muted" style={{ fontSize: '0.72rem', marginLeft: 4 }}>
                                  ({formatFileSize(f.file_size_bytes)})
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={actionId !== null}
                          onClick={() => void review(r.id, true)}
                        >
                          核准
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={actionId !== null}
                          onClick={() => void review(r.id, false)}
                        >
                          駁回
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && rows.some((r) => r.status !== 'pending') ? (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>近期已處理</h2>
          <div className="table-wrap card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data" style={{ width: '100%', minWidth: 720 }}>
              <thead>
                <tr>
                  <th>時間</th>
                  <th>類型</th>
                  <th>租盤</th>
                  <th>結果</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.status !== 'pending')
                  .slice(0, 30)
                  .map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleString('zh-HK')}
                      </td>
                      <td>{REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type}</td>
                      <td>{titleOf(r)}</td>
                      <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
