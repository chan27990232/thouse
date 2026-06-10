import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PropertyLeaseRecordBlock } from '../components/PropertyLeaseRecordBlock';
import { PropertyUtilityBillsBlock } from '../components/PropertyUtilityBillsBlock';
import {
  type LeaseRecord,
  type RentRecord,
  type UtilityObligationRecord,
  type UtilityRecord,
  buildPayoutPeriods,
  buildPropertyRecordsBundle,
  groupUtilityRecordsByMonth,
  pickLastPayoutPaid,
  pickNextPayoutDue,
  pickNextUtilityDue,
  pickPendingUtilityReviewMonths,
} from '../lib/propertyRecords';
import { supabase } from '../lib/supabase';

type PropertyRow = {
  id: string;
  title: string;
  image: string;
  price: number;
  area: number;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  district: string;
  description: string;
  status: string;
  landlord_id: string | null;
  verification_status: string | null;
  updated_at: string;
  landlord?: { full_name: string; email: string; phone: string; role: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  available: '放租中',
  rented: '已租出',
  draft: '草稿',
  inactive: '下架',
};

const LEASE_STATUS_LABEL: Record<string, string> = {
  awaiting_platform_1: '待平台初審',
  awaiting_landlord: '待業主回覆',
  awaiting_platform_2: '待平台複審',
  approved: '已核准',
  rejected: '已駁回',
};

const PAYOUT_LABEL: Record<string, string> = {
  pending: '待轉交',
  processing: '處理中',
  paid: '已轉交業主',
};

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

function PropertyScopeTag({ title, district }: { title: string; district: string }) {
  return (
    <span className="property-scope-tag">
      本租盤 · {title}
      {district ? `（${district}）` : ''}
    </span>
  );
}

export function PropertyManagePage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [leases, setLeases] = useState<LeaseRecord[]>([]);
  const [rents, setRents] = useState<RentRecord[]>([]);
  const [utilities, setUtilities] = useState<UtilityRecord[]>([]);
  const [utilityObligations, setUtilityObligations] = useState<UtilityObligationRecord[]>([]);
  const [utilityUrls, setUtilityUrls] = useState<Record<string, string>>({});
  const [savingPayout, setSavingPayout] = useState<string | null>(null);
  const [reviewingMonth, setReviewingMonth] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr('');

    const { data: prop, error: propErr } = await supabase
      .from('properties')
      .select(
        'id, title, image, price, area, floor, bedrooms, bathrooms, district, description, status, landlord_id, verification_status, updated_at'
      )
      .eq('id', id)
      .single();

    if (propErr || !prop) {
      setErr(propErr?.message ?? '找不到租盤');
      setProperty(null);
      setLoading(false);
      return;
    }

    let landlord: PropertyRow['landlord'] = null;
    if (prop.landlord_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, email, phone, role')
        .eq('id', prop.landlord_id)
        .maybeSingle();
      landlord = prof;
    }

    const [leaseRes, rentRes, utilRes, utilPayRes] = await Promise.all([
      supabase
        .from('lease_applications')
        .select(
          `id, property_id, created_at, full_name, email, phone, status, move_in_date, lease_duration_months, first_payment_total,
           payment_method, payment_status, payment_reference, bank_transfer_receipt_url, paid_at,
           landlord_payout_status, landlord_paid_at`
        )
        .eq('property_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('rent_payments')
        .select(
          'id, property_id, lease_application_id, period_index, due_date, amount, status, payment_method, payment_reference, bank_transfer_receipt_url, paid_at, landlord_payout_status, landlord_paid_at'
        )
        .eq('property_id', id)
        .order('period_index', { ascending: true }),
      supabase
        .from('property_utility_bills')
        .select(
          'id, property_id, bill_month, bill_type, original_filename, storage_path, tenant_payable_hkd, review_status, reviewed_at, review_notes, created_at, updated_at'
        )
        .eq('property_id', id)
        .order('bill_month', { ascending: false }),
      supabase
        .from('tenant_utility_obligations')
        .select(
          'id, property_id, lease_application_id, bill_month, bill_type, amount, due_date, upload_at, status, payment_method, bank_transfer_receipt_url, paid_at, landlord_payout_status, landlord_paid_at'
        )
        .eq('property_id', id)
        .order('bill_month', { ascending: true }),
    ]);

    if (leaseRes.error) setErr(leaseRes.error.message);
    if (rentRes.error) setErr((prev) => (prev ? `${prev}；` : '') + rentRes.error.message);
    if (utilRes.error) setErr((prev) => (prev ? `${prev}；` : '') + utilRes.error.message);
    if (utilPayRes.error) setErr((prev) => (prev ? `${prev}；` : '') + utilPayRes.error.message);

    setProperty({ ...(prop as PropertyRow), landlord });
    setLeases((leaseRes.data as unknown as LeaseRecord[]) ?? []);
    setRents((rentRes.data as unknown as RentRecord[]) ?? []);
    const utilRows = (utilRes.data as unknown as UtilityRecord[]) ?? [];
    setUtilities(utilRows);
    setUtilityObligations((utilPayRes.data as unknown as UtilityObligationRecord[]) ?? []);

    const urlMap: Record<string, string> = {};
    for (const u of utilRows) {
      const { data: signed } = await supabase.storage
        .from('property-verification')
        .createSignedUrl(u.storage_path, 3600);
      if (signed?.signedUrl) urlMap[u.id] = signed.signedUrl;
    }
    setUtilityUrls(urlMap);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateLeasePayout(leaseId: string, status: string) {
    setSavingPayout(`lease-${leaseId}`);
    const payload: Record<string, unknown> = { landlord_payout_status: status };
    payload.landlord_paid_at = status === 'paid' ? new Date().toISOString() : null;
    const { error } = await supabase.from('lease_applications').update(payload).eq('id', leaseId);
    setSavingPayout(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  async function reviewUtilityMonth(billMonth: string, approve: boolean) {
    if (!id) return;
    setReviewingMonth(billMonth);
    const { error } = await supabase.rpc('review_utility_bills_month', {
      p_property_id: id,
      p_bill_month: `${billMonth}-01`,
      p_approve: approve,
      p_notes: null,
    });
    setReviewingMonth(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  async function updateRentPayout(rentId: string, status: string) {
    setSavingPayout(`rent-${rentId}`);
    const payload: Record<string, unknown> = { landlord_payout_status: status };
    payload.landlord_paid_at = status === 'paid' ? new Date().toISOString() : null;
    const { error } = await supabase.from('rent_payments').update(payload).eq('id', rentId);
    setSavingPayout(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  async function updateUtilityPayout(utilityId: string, status: string) {
    setSavingPayout(`utility-${utilityId}`);
    const payload: Record<string, unknown> = { landlord_payout_status: status };
    payload.landlord_paid_at = status === 'paid' ? new Date().toISOString() : null;
    const { error } = await supabase
      .from('tenant_utility_obligations')
      .update(payload)
      .eq('id', utilityId);
    setSavingPayout(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  const bundle = useMemo(() => {
    if (!id) return null;
    return buildPropertyRecordsBundle(id, leases, rents, utilities);
  }, [id, leases, rents, utilities]);

  const activeGroup = useMemo(() => {
    if (!bundle?.activeLease) return bundle?.leaseGroups[0] ?? null;
    return (
      bundle.leaseGroups.find((g) => g.lease.id === bundle.activeLease!.id) ?? {
        lease: bundle.activeLease,
        rents: bundle.rents.filter((r) => r.lease_application_id === bundle.activeLease!.id),
      }
    );
  }, [bundle]);

  const historicalGroups = useMemo(() => {
    if (!bundle) return [];
    return bundle.leaseGroups.filter((g) => g.lease.id !== bundle.activeLease?.id);
  }, [bundle]);

  const obligationsForLease = useCallback(
    (leaseId: string) => utilityObligations.filter((o) => o.lease_application_id === leaseId),
    [utilityObligations]
  );

  const activeUtilityObligations = useMemo(
    () => (activeGroup ? obligationsForLease(activeGroup.lease.id) : []),
    [activeGroup, obligationsForLease]
  );

  const payoutPeriods = useMemo(
    () =>
      activeGroup
        ? buildPayoutPeriods(activeGroup.lease, activeGroup.rents, activeUtilityObligations)
        : [],
    [activeGroup, activeUtilityObligations]
  );
  const nextPayoutDue = useMemo(() => pickNextPayoutDue(payoutPeriods), [payoutPeriods]);
  const lastPayoutPaid = useMemo(() => pickLastPayoutPaid(payoutPeriods), [payoutPeriods]);
  const nextUtilityDue = useMemo(() => (bundle ? pickNextUtilityDue(bundle.utilities) : null), [bundle]);
  const pendingReviewMonths = useMemo(() => pickPendingUtilityReviewMonths(utilities), [utilities]);
  const utilityMonthGroups = useMemo(() => groupUtilityRecordsByMonth(utilities), [utilities]);
  const lastUploadMonth = utilityMonthGroups[0]?.[0] ?? null;

  if (!id) return <Navigate to="/properties" replace />;

  const approvedLease = bundle?.activeLease ?? null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <Link to="/properties">← 租盤列表</Link>
          <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem' }}>管理租盤</h1>
        </div>
        <Link to={`/properties/${id}/edit`} className="btn btn-primary">
          編輯租盤
        </Link>
      </div>

      {err ? <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{err}</p> : null}
      {loading ? (
        <p className="muted">載入中…</p>
      ) : property && bundle ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section className="card">
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>租盤詳情</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '0.75rem 1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <div>
                <span className="muted">標題</span>
                <div>{property.title}</div>
              </div>
              <div>
                <span className="muted">地區</span>
                <div>{property.district}</div>
              </div>
              <div>
                <span className="muted">月租</span>
                <div>HK${property.price?.toLocaleString()}</div>
              </div>
              <div>
                <span className="muted">面積 / 樓層</span>
                <div>
                  {property.area} 呎 · {property.floor} 樓
                </div>
              </div>
              <div>
                <span className="muted">間隔</span>
                <div>
                  {property.bedrooms} 房 · {property.bathrooms} 廁
                </div>
              </div>
              <div>
                <span className="muted">狀態</span>
                <div>
                  <span className="badge open">{STATUS_LABEL[property.status] ?? property.status}</span>
                </div>
              </div>
              <div>
                <span className="muted">業主</span>
                <div>
                  {property.landlord?.full_name?.trim() || '—'}
                  <br />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {property.landlord?.email ?? property.landlord_id ?? '—'}
                  </span>
                </div>
              </div>
              <div>
                <span className="muted">租盤 ID</span>
                <div className="muted" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>
                  {property.id}
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>租約與租客</h2>
            {!approvedLease ? (
              <p className="muted" style={{ margin: 0 }}>
                此租盤尚無租約申請紀錄。
              </p>
            ) : (
              <div style={{ fontSize: '0.9rem' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.65rem 1rem',
                  }}
                >
                  <div>
                    <span className="muted">租客</span>
                    <div>
                      {approvedLease.full_name}
                      <br />
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        {approvedLease.email} · {approvedLease.phone}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="muted">租約狀態</span>
                    <div>{LEASE_STATUS_LABEL[approvedLease.status] ?? approvedLease.status}</div>
                  </div>
                  <div>
                    <span className="muted">入住日</span>
                    <div>{approvedLease.move_in_date ?? '—'}</div>
                  </div>
                  <div>
                    <span className="muted">租期</span>
                    <div>{approvedLease.lease_duration_months} 個月</div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="card property-records-section" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>租客付款進度</h2>
              <PropertyScopeTag title={property.title} district={property.district} />
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                含租金與水電煤繳付紀錄。藍點＝最近要交，綠點＝上次最新已交。
              </p>
            </div>
            {!activeGroup && historicalGroups.length === 0 ? (
              <p className="muted" style={{ padding: '1rem 1.25rem' }}>
                此租盤尚無付款紀錄
              </p>
            ) : null}
            {activeGroup ? (
              <PropertyLeaseRecordBlock
                propertyTitle={property.title}
                lease={activeGroup.lease}
                rents={activeGroup.rents}
                utilityObligations={obligationsForLease(activeGroup.lease.id)}
                isActive
                savingPayout={savingPayout}
                onLeasePayout={(lid, s) => void updateLeasePayout(lid, s)}
                onRentPayout={(rid, s) => void updateRentPayout(rid, s)}
                onUtilityPayout={(uid, s) => void updateUtilityPayout(uid, s)}
              />
            ) : null}
            {historicalGroups.length > 0 ? (
              <details className="property-history-leases" style={{ padding: '0 1.25rem 1rem' }}>
                <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                  歷史租約紀錄（{historicalGroups.length}）
                </summary>
                {historicalGroups.map((group) => (
                  <PropertyLeaseRecordBlock
                    key={group.lease.id}
                    propertyTitle={property.title}
                    lease={group.lease}
                    rents={group.rents}
                    utilityObligations={obligationsForLease(group.lease.id)}
                    isActive={false}
                    savingPayout={savingPayout}
                    onLeasePayout={(lid, s) => void updateLeasePayout(lid, s)}
                    onRentPayout={(rid, s) => void updateRentPayout(rid, s)}
                    onUtilityPayout={(uid, s) => void updateUtilityPayout(uid, s)}
                  />
                ))}
              </details>
            ) : null}
          </section>

          <section className="card property-records-section" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>業主水電煤上傳記錄</h2>
              <PropertyScopeTag title={property.title} district={property.district} />
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                業主上傳後須於此處審核；核准後租客方可查看帳單並繳付水電煤。
              </p>
            </div>
            <PropertyUtilityBillsBlock
              monthGroups={utilityMonthGroups}
              utilityUrls={utilityUrls}
              nextUploadMonth={nextUtilityDue?.month ?? null}
              lastUploadMonth={lastUploadMonth}
              pendingReviewMonths={pendingReviewMonths}
              reviewingMonth={reviewingMonth}
              onReview={(month, approve) => void reviewUtilityMonth(month, approve)}
            />
          </section>

          <section className="card property-records-section">
            <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem' }}>公司轉交業主進度</h2>
            <PropertyScopeTag title={property.title} district={property.district} />
            <p className="muted" style={{ margin: '0.5rem 0 0.75rem', fontSize: '0.85rem' }}>
              含租金與水電煤；僅統計此租盤現時租約，可在上方表格更新各帳項轉交狀態。
            </p>
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
            {activeGroup ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {(['pending', 'processing', 'paid'] as const).map((s) => {
                  const initial =
                    activeGroup.lease.landlord_payout_status === s &&
                    (activeGroup.lease.payment_status === 'succeeded' ||
                      activeGroup.lease.payment_status === 'pending_bank')
                      ? 1
                      : 0;
                  const monthly = activeGroup.rents.filter((r) => r.landlord_payout_status === s).length;
                  const utility = activeUtilityObligations.filter(
                    (u) => (u.landlord_payout_status ?? 'pending') === s
                  ).length;
                  return (
                    <div key={s} className="card" style={{ flex: '1 1 140px', marginBottom: 0, padding: '0.75rem 1rem' }}>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>
                        {PAYOUT_LABEL[s]}
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 600, marginTop: '0.2rem' }}>
                        {initial + monthly + utility}
                        <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 400 }}>
                          {' '}
                          項
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                此租盤尚無轉交紀錄
              </p>
            )}
          </section>
        </div>
      ) : (
        <p className="muted">找不到租盤</p>
      )}
    </div>
  );
}
