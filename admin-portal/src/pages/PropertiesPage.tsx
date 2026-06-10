import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { dedupePropertiesForAdmin, type LandlordInfo } from '../lib/propertyList';
import {
  type LeaseRecord,
  type RentRecord,
  type UtilityRecord,
  type PropertyRecordSnapshot,
  buildPropertyRecordsBundle,
  summarizePropertyRecords,
} from '../lib/propertyRecords';

type Row = {
  id: string;
  title: string;
  district: string;
  price: number;
  status: string;
  area: number;
  floor: number;
  created_at: string;
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
  const [recordSummaries, setRecordSummaries] = useState<Record<string, PropertyRecordSnapshot>>({});
  const [listingActionId, setListingActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const { data: raw, error } = await supabase
      .from('properties')
      .select('id, title, district, price, status, area, floor, created_at, updated_at, landlord_id, verification_status')
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
    const merged = unique.map((r) => {
      const lid = r.landlord_id ? normId(r.landlord_id) : '';
      return {
        ...r,
        landlord: lid ? byId.get(lid) : undefined,
      };
    });
    setRows(merged);

    const propertyIds = merged.map((r) => r.id);
    if (propertyIds.length > 0) {
      const [leaseRes, rentRes, utilRes] = await Promise.all([
        supabase
          .from('lease_applications')
          .select(
            `id, property_id, created_at, full_name, email, phone, status, move_in_date, lease_duration_months, first_payment_total,
             payment_method, payment_status, paid_at, landlord_payout_status, landlord_paid_at`
          )
          .in('property_id', propertyIds),
        supabase
          .from('rent_payments')
          .select(
            'id, property_id, lease_application_id, period_index, due_date, amount, status, payment_method, paid_at, landlord_payout_status, landlord_paid_at'
          )
          .in('property_id', propertyIds),
        supabase
          .from('property_utility_bills')
          .select('id, property_id, bill_month, original_filename, storage_path, tenant_payable_hkd, created_at, updated_at')
          .in('property_id', propertyIds),
      ]);

      const allLeases = (leaseRes.data as unknown as LeaseRecord[]) ?? [];
      const allRents = (rentRes.data as unknown as RentRecord[]) ?? [];
      const allUtils = (utilRes.data as unknown as UtilityRecord[]) ?? [];
      const summaryMap: Record<string, PropertyRecordSnapshot> = {};
      for (const pid of propertyIds) {
        const bundle = buildPropertyRecordsBundle(pid, allLeases, allRents, allUtils);
        summaryMap[pid] = summarizePropertyRecords(bundle);
      }
      setRecordSummaries(summaryMap);
    } else {
      setRecordSummaries({});
    }

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

  function matchesSearch(r: Row) {
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
  }

  const pendingListings = rows.filter(
    (r) => (r.verification_status ?? '') === 'pending' && matchesSearch(r)
  );

  const managedListings = rows.filter((r) => {
    if ((r.verification_status ?? '') === 'pending') return false;
    if (verFilter && (r.verification_status ?? '') !== verFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return matchesSearch(r);
  });

  async function approveListing(propertyId: string) {
    setListingActionId(propertyId);
    setErr('');
    const { data, error } = await supabase
      .from('properties')
      .update({
        verification_status: 'approved',
        verification_rejected_reason: '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId)
      .select('id');
    setListingActionId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    if (!data?.length) {
      setErr('核准失敗：找不到租盤或無權限更新。');
      return;
    }
    await load();
  }

  async function rejectListing(propertyId: string) {
    const reason = window.prompt('請填寫駁回原因（業主會看到）：');
    if (reason === null) return;
    if (!reason.trim()) {
      setErr('請填寫駁回原因。');
      return;
    }
    setListingActionId(propertyId);
    setErr('');
    const { data, error } = await supabase
      .from('properties')
      .update({
        verification_status: 'rejected',
        verification_rejected_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId)
      .select('id');
    setListingActionId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    if (!data?.length) {
      setErr('駁回失敗：找不到租盤或無權限更新。');
      return;
    }
    await load();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>租盤</h1>
      <p className="muted" style={{ marginBottom: '0.5rem' }}>
        查閱與管理租盤、狀態。同一標題多筆時，列表優先顯示已填業主的一筆。從「管理」返回若未更新請
        <button type="button" className="btn" style={{ marginLeft: '0.35rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => void load()}>
          重新載入
        </button>
        。庫內重複可執行 <code>npm run db:dedupe-properties</code>。
      </p>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        業主新提交的放盤會出現在下方「租盤上傳申請」待審核；核准後方會顯示於租客首頁。已審核租盤請在「租盤管理」區查閱。
      </p>
      {err && <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{err}</p>}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          租盤上傳申請（待審核 {pendingListings.length}）
        </h2>
        <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          業主刊登租盤後須審核實景相片與房產證明。可在此快速核准／駁回，或點「審核」查看完整資料。
        </p>
        {loading ? (
          <p className="muted">載入中…</p>
        ) : pendingListings.length === 0 ? (
          <p className="muted card" style={{ padding: '1rem 1.25rem', marginBottom: 0 }}>
            目前沒有待審核的租盤上傳申請
          </p>
        ) : (
          <div className="table-wrap card" style={{ padding: 0 }}>
            <table className="data" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th>提交時間</th>
                  <th>標題 / 地區</th>
                  <th>業主</th>
                  <th>月租</th>
                  <th>規格</th>
                  <th style={{ minWidth: 200 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingListings.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {new Date(r.created_at).toLocaleString('zh-HK')}
                    </td>
                    <td>
                      {r.title}
                      <br />
                      <span className="muted" style={{ fontSize: '0.75rem' }}>
                        {r.district}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div>{landlordNameLine(r)}</div>
                      <div className="muted" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>
                        {r.landlord_id ?? '—'}
                      </div>
                    </td>
                    <td>HK${r.price?.toLocaleString()}</td>
                    <td className="muted" style={{ fontSize: '0.8rem' }}>
                      {r.area} 呎 · {r.floor} 樓
                    </td>
                    <td>
                      <Link to={`/properties/${r.id}/edit`} className="btn btn-sm" style={{ marginRight: '0.35rem' }}>
                        審核
                      </Link>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={listingActionId !== null}
                        onClick={() => void approveListing(r.id)}
                      >
                        {listingActionId === r.id ? '處理中…' : '核准'}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={listingActionId !== null}
                        onClick={() => void rejectListing(r.id)}
                      >
                        駁回
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>租盤管理</h2>
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
          <option value="">全部（不含待審）</option>
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
                <th>記錄摘要</th>
                <th>更新</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {managedListings.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: '1.5rem' }}>
                    沒有租盤（待審核申請請見上方區塊）
                  </td>
                </tr>
              )}
              {managedListings.map((r) => {
                const snap = recordSummaries[r.id];
                return (
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
                  <td style={{ fontSize: '0.72rem', lineHeight: 1.45, maxWidth: '200px' }}>
                    {snap ? (
                      <>
                        <div>
                          <span className="muted">租</span>{' '}
                          {snap.tenantNext ? (
                            <span title={snap.tenantNext}>待：{snap.tenantNext}</span>
                          ) : (
                            <span className="muted">無待繳</span>
                          )}
                        </div>
                        <div>
                          <span className="muted">水電</span>{' '}
                          {snap.utilityNext ? (
                            <span>待：{snap.utilityNext}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                        <div>
                          <span className="muted">轉業主</span>{' '}
                          {snap.payoutNext ? (
                            <span>待：{snap.payoutNext}</span>
                          ) : (
                            <span className="muted">無</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: '0.8rem' }}>
                    {r.updated_at?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td>
                    <Link to={'/properties/' + r.id}>管理</Link>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
