import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { dedupePropertiesForAdmin, type LandlordInfo } from '../lib/propertyList';

type Row = {
  id: string;
  title: string;
  district: string;
  price: number;
  status: string;
  area: number;
  floor: number;
  updated_at: string;
  landlord_id: string | null;
  /** 審核狀態（欄位未套用 migration 可能為空） */
  verification_status: string | null;
  landlord?: LandlordInfo;
};

const STATUS_LABEL: Record<string, string> = {
  available: '放租中',
  rented: '已租出',
  draft: '草稿',
  inactive: '下架',
};

const VER_LABEL: Record<string, string> = {
  pending: '待審',
  approved: '已核准',
  rejected: '已駁回',
};

function statusBadgeClass(status: string) {
  if (status === 'available') return 'open';
  if (status === 'rented') return 'rented';
  if (status === 'draft') return 'draft';
  if (status === 'inactive') return 'inactive';
  return 'closed';
}

function verBadgeClass(ver: string | null) {
  if (ver === 'approved') return 'open';
  if (ver === 'rejected') return 'rented';
  if (ver === 'pending') return 'draft';
  return 'closed';
}

function normId(s: string | null | undefined) {
  return (s ?? '').trim().toLowerCase();
}

export function PropertiesPage() {
  const location = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [verFilter, setVerFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const { data: raw, error } = await supabase
      .from('properties')
      .select('id, title, district, price, status, area, floor, updated_at, landlord_id, verification_status')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const base = (raw ?? []) as Row[];
    const unique = dedupePropertiesForAdmin(base);
    const ids = [...new Set(unique.map((r) => r.landlord_id).filter((x): x is string => Boolean(x)))];
    let byId = new Map<string, LandlordInfo>();
    if (ids.length > 0) {
      const { data: profs, error: pe } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, phone')
        .in('id', ids);
      if (pe) {
        setErr(pe.message);
      } else {
        byId = new Map(
          ((profs as LandlordInfo[] | null) ?? []).map((p) => [normId(p.id), p] as [string, LandlordInfo])
        );
      }
    }
    setRows(
      unique.map((r) => {
        const lid = r.landlord_id ? normId(r.landlord_id) : '';
        return {
          ...r,
          landlord: lid ? byId.get(lid) : undefined,
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (location.pathname !== '/properties') return;
    void load();
  }, [location.pathname, location.key, load]);

  /** 業主顯示名（user id 另起一行顯示） */
  function landlordNameLine(r: Row) {
    const p = r.landlord;
    if (p) {
      const em = (p.email ?? '').trim() || '（無 email）';
      const name = p.full_name?.trim();
      if (name) return `${name} · ${em}`;
      return em;
    }
    if (r.landlord_id) {
      return '（profiles 未載入）';
    }
    return '—';
  }

  const filtered = rows.filter((r) => {
    if (verFilter && (r.verification_status ?? '') !== verFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    const p = r.landlord;
    return (
      (r.title && r.title.toLowerCase().includes(t)) ||
      (r.district && r.district.toLowerCase().includes(t)) ||
      (p?.email && p.email.toLowerCase().includes(t)) ||
      (p?.full_name && p.full_name.toLowerCase().includes(t)) ||
      (r.landlord_id && r.landlord_id.toLowerCase().includes(t)) ||
      r.id.toLowerCase().includes(t)
    );
  });

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>租盤</h1>
      <p className="muted" style={{ marginBottom: '0.5rem' }}>
        查閱與編輯租盤、狀態。同一標題多筆時，列表優先顯示已填業主的一筆。從「編輯」返回若未更新請
        <button type="button" className="btn" style={{ marginLeft: '0.35rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => void load()}>
          重新載入
        </button>
        。庫內重複可執行 <code>npm run db:dedupe-properties</code>。
      </p>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        狀態以資料庫為準；與實況不符請點「編輯」修改（例：實際已租出可改「已租出」）。
      </p>
      {err && <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{err}</p>}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="搜尋標題／地區／業主 user id／名稱…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: '180px' }}
        />
        <span className="muted">狀態</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: '140px' }}>
          <option value="">全部</option>
          <option value="available">放租中</option>
          <option value="rented">已租出</option>
          <option value="draft">草稿</option>
          <option value="inactive">下架</option>
        </select>
        <span className="muted">審核</span>
        <select value={verFilter} onChange={(e) => setVerFilter(e.target.value)} style={{ minWidth: '120px' }}>
          <option value="">全部</option>
          <option value="pending">待審</option>
          <option value="approved">已核准</option>
          <option value="rejected">已駁回</option>
        </select>
      </div>
      {loading ? (
        <p className="muted">載入中…</p>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>標題 / 地區</th>
                <th>業主 user id / 名稱</th>
                <th>租金</th>
                <th>狀態</th>
                <th>審核</th>
                <th>更新</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: '1.5rem' }}>
                    沒有租盤
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.title}
                    <br />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      {r.district}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.72rem',
                        color: '#8b949e',
                        wordBreak: 'break-all',
                        lineHeight: 1.35,
                      }}
                      title="業主 user id = profiles.id = auth.uid()"
                    >
                      {r.landlord_id ?? '—'}
                    </div>
                    <div style={{ marginTop: '0.35rem', color: '#e6edf3' }}>{landlordNameLine(r)}</div>
                  </td>
                  <td>${r.price?.toLocaleString()}</td>
                  <td>
                    <span className={'badge ' + statusBadgeClass(r.status)}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>
                    {r.verification_status ? (
                      <span className={'badge ' + verBadgeClass(r.verification_status)}>
                        {VER_LABEL[r.verification_status] ?? r.verification_status}
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        —
                      </span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: '0.8rem' }}>
                    {r.updated_at?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td>
                    <Link to={'/properties/' + r.id}>編輯</Link>
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
