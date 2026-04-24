import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Landlord = { full_name: string; email: string; phone: string; role: string } | null;

const STATUS_OPTIONS = [
  { value: 'available', label: '放租中' },
  { value: 'rented', label: '已租出' },
  { value: 'draft', label: '草稿' },
  { value: 'inactive', label: '下架' },
];

export function PropertyEditPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [landlord, setLandlord] = useState<Landlord>(null);
  /** 可編輯；儲存時寫入 properties.landlord_id（= 用戶頁 UUID） */
  const [landlordIdEdit, setLandlordIdEdit] = useState('');
  /** 從庫內讀回的值；業主欄位若被清空，儲存時仍沿用此值（庫內欄位為 not null，不可無業主） */
  const [loadedLandlordId, setLoadedLandlordId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    image: '',
    price: 0,
    area: 0,
    floor: 0,
    bedrooms: 1,
    bathrooms: 1,
    district: '',
    description: '',
    status: 'available' as string,
  });
  const [verSaving, setVerSaving] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [rejectionReadonly, setRejectionReadonly] = useState('');
  const [rejectDraft, setRejectDraft] = useState('');
  const [proofSignedUrls, setProofSignedUrls] = useState<string[]>([]);
  const [deedSignedUrl, setDeedSignedUrl] = useState<string | null>(null);
  /** 核准／駁回操作成功後的提示（僅在切換租盤 id 時清除，避免載入中覆寫） */
  const [verifySuccessMsg, setVerifySuccessMsg] = useState('');

  useEffect(() => {
    setVerifySuccessMsg('');
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let c = false;
    (async () => {
      setLoading(true);
      setErr('');
      setProofSignedUrls([]);
      setDeedSignedUrl(null);
      setRejectDraft('');
      const { data, error } = await supabase
        .from('properties')
        .select(
          'id, title, image, price, area, floor, bedrooms, bathrooms, district, description, status, landlord_id, proof_photo_urls, property_deed_url, verification_status, verification_rejected_reason'
        )
        .eq('id', id)
        .single();
      if (c) return;
      if (error || !data) {
        setLoadFailed(true);
        setLoadedLandlordId(null);
        setErr(error?.message ?? '找不到租盤');
        setLoading(false);
        return;
      }
      const d = data as {
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
        proof_photo_urls?: unknown;
        property_deed_url?: string | null;
        verification_status?: string | null;
        verification_rejected_reason?: string | null;
      };
      setLoadedLandlordId(d.landlord_id ?? null);
      setLandlordIdEdit(d.landlord_id ?? '');
      if (d.landlord_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email, phone, role')
          .eq('id', d.landlord_id)
          .maybeSingle();
        if (!c && prof) {
          setLandlord(prof as Landlord);
        } else {
          setLandlord(null);
        }
      } else {
        setLandlord(null);
      }
      if (c) return;

      setVerificationStatus(d.verification_status ?? null);
      setRejectionReadonly((d.verification_rejected_reason ?? '').trim());

      let proofPaths: string[] = [];
      const rp = d.proof_photo_urls;
      if (Array.isArray(rp)) {
        proofPaths = rp as string[];
      } else if (typeof rp === 'string' && rp.trim().startsWith('[')) {
        try {
          proofPaths = JSON.parse(rp) as string[];
        } catch {
          proofPaths = [];
        }
      }
      const deedPath = (d.property_deed_url ?? '').toString().trim();

      const proofUrls: string[] = [];
      for (const p of proofPaths) {
        if (typeof p !== 'string' || !p) continue;
        const { data: s } = await supabase.storage.from('property-verification').createSignedUrl(p, 3600);
        if (s?.signedUrl) proofUrls.push(s.signedUrl);
      }
      if (deedPath) {
        const { data: s2 } = await supabase.storage.from('property-verification').createSignedUrl(deedPath, 3600);
        setDeedSignedUrl(s2?.signedUrl ?? null);
      } else {
        setDeedSignedUrl(null);
      }
      if (!c) {
        setProofSignedUrls(proofUrls);
      }

      setForm({
        title: d.title ?? '',
        image: d.image ?? '',
        price: d.price ?? 0,
        area: d.area ?? 0,
        floor: d.floor ?? 0,
        bedrooms: d.bedrooms ?? 1,
        bathrooms: d.bathrooms ?? 1,
        district: d.district ?? '',
        description: d.description ?? '',
        status: d.status ?? 'available',
      });
      setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [id]);

  if (!id) return <Navigate to="/properties" replace />;

  function isUuid(s: string) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      s.trim()
    );
  }

  function normalizeLid(s: string) {
    return s.replace(/[\s\u200b-\u200d\ufeff\u2060-\u206f\ufe00-\ufe0f]/g, '').trim();
  }

  async function save() {
    if (!id) return;
    setSaveOk(false);
    const fromInput = normalizeLid(landlordIdEdit);
    if (fromInput && !isUuid(fromInput)) {
      setErr('業主 user id 須為完整 UUID（與用戶頁的 profiles 相同，勿含空白或奇異符號）。');
      return;
    }
    const fallback = loadedLandlordId ? normalizeLid(loadedLandlordId) : '';
    const lid = fromInput || fallback;
    if (!lid) {
      setErr('租盤必須有業主 user id，請從「用戶」複製房東的 UUID 貼上。');
      return;
    }
    if (!isUuid(lid)) {
      setErr('業主 user id 須為完整 UUID（與用戶頁的 profiles 相同）。');
      return;
    }
    setSaving(true);
    setErr('');
    const { error } = await supabase
      .from('properties')
      .update({
        landlord_id: lid,
        title: form.title.trim() || '未命名',
        image: form.image.trim(),
        price: Math.max(0, Math.floor(form.price)),
        area: Math.max(0, Math.floor(form.area)),
        floor: Math.max(0, Math.floor(form.floor)),
        bedrooms: Math.max(1, Math.floor(form.bedrooms)),
        bathrooms: Math.max(1, Math.floor(form.bathrooms)),
        district: form.district.trim(),
        description: form.description,
        status: form.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setSaving(false);
    if (error) {
      setErr(
        error.message +
          (String(error.message).toLowerCase().includes('policy') || String(error.message).includes('權限')
            ? '（若曾未執行，請在專根跑：npm run db:admin-properties-policy）'
            : '')
      );
      return;
    }
    setLoadedLandlordId(lid);
    setLandlordIdEdit(lid);
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, email, phone, role')
      .eq('id', lid)
      .maybeSingle();
    if (prof) setLandlord(prof as Landlord);
    else setLandlord(null);
    setSaveOk(true);
  }

  async function verifyApprove() {
    if (!id) return;
    setVerSaving(true);
    setErr('');
    // 勿用 update().select() 依賴回傳列：PostgREST 的 RETURNING 須同時通過 SELECT RLS，
    // 有時 UPDATE 已寫入卻因 SELECT 讀回為空，誤判成「審核未寫入」。
    const { error } = await supabase
      .from('properties')
      .update({
        verification_status: 'approved',
        verification_rejected_reason: '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setVerSaving(false);
    if (error) {
      setErr(
        error.message +
          (String(error.message).toLowerCase().includes('policy') || String(error.message).includes('權限')
            ? '（請確認帳號已寫入 app_admins 並執行 admin_properties_write.sql。）'
            : '')
      );
      return;
    }
    setVerificationStatus('approved');
    setRejectionReadonly('');
    setRejectDraft('');
    const line = '核准成功。此租盤已上首頁，租客可於 App 內搜尋、洽詢與申請。';
    setVerifySuccessMsg(line);
    window.alert(`核准成功\n\n${line}`);
  }

  async function verifyReject() {
    if (!id) return;
    if (!rejectDraft.trim()) {
      setErr('請填寫駁回原因（業主會看到此說明）。');
      return;
    }
    setVerSaving(true);
    setErr('');
    const { error } = await supabase
      .from('properties')
      .update({
        verification_status: 'rejected',
        verification_rejected_reason: rejectDraft.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setVerSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setVerificationStatus('rejected');
    setRejectionReadonly(rejectDraft.trim());
    const line = '已送出駁回。業主可於 App 內看到原因；若重傳證明，此盤會回到待審。';
    setVerifySuccessMsg(line);
    window.alert(`已駁回\n\n${line}`);
  }

  if (loadFailed) {
    return (
      <div>
        <p>
          <Link to="/properties">← 租盤列表</Link>
        </p>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          {err}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link to="/properties">← 租盤列表</Link>
      </p>
      <h1 style={{ marginTop: '0.5rem', fontSize: '1.35rem' }}>編輯租盤</h1>

      {loading ? (
        <p className="muted">載入中…</p>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>業主（房東用戶）</h2>
            <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              業主 user id（= <code>landlord_id</code> = 用戶頁的 UUID，例如 <code>landlord@thouse.local</code> 一列）
            </label>
            <input
              value={landlordIdEdit}
              onChange={(e) => setLandlordIdEdit(e.target.value)}
              placeholder="1e2e499b-d642-433d-a728-086ecc0bb331"
              style={{
                width: '100%',
                maxWidth: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.8rem',
              }}
            />
            {landlord ? (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem' }}>
                {landlord.full_name || '—'} · {landlord.email || '（無 email）'}
                <br />
                <span className="muted">身份：{landlord.role} {landlord.phone ? `· 電話：${landlord.phone}` : ''}</span>
              </p>
            ) : (
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                {landlordIdEdit.trim() ? '此 UUID 在 profiles 查無資料，儲存後若仍顯示此句請確認用戶已註冊' : '貼上房東的 UUID 後儲存租盤即可掛在該用戶名下'}
              </p>
            )}
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
              與「用戶」頁該行 UUID 必須一致，租盤才歸屬該帳戶。
            </p>
          </div>

          {saveOk && <p style={{ color: '#3fb950', fontSize: '0.9rem' }}>已儲存。請到「租盤列表」按「重新載入」或再進入列表查看業主欄。</p>}
          {err && <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{err}</p>}

          <div className="card" style={{ marginBottom: '1rem', maxWidth: '720px' }}>
            <h2 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>實名審核</h2>
            {verifySuccessMsg && (
              <p
                role="status"
                style={{
                  color: '#3fb950',
                  fontSize: '0.9rem',
                  margin: '0 0 0.75rem',
                  padding: '0.5rem 0.6rem',
                  background: 'rgba(63, 185, 80, 0.12)',
                  borderRadius: 6,
                  border: '1px solid rgba(63, 185, 80, 0.35)',
                }}
              >
                {verifySuccessMsg}
              </p>
            )}
            {verificationStatus == null && (
              <p className="muted" style={{ fontSize: '0.9rem' }}>
                庫內若尚無審核欄位，請在 Supabase 執行 <code>property_listing_verification.sql</code>。
              </p>
            )}
            {verificationStatus != null && (
              <>
                <p style={{ fontSize: '0.9rem' }}>
                  狀態：
                  {verificationStatus === 'pending' && '待審核'}
                  {verificationStatus === 'approved' && '已核准上首頁'}
                  {verificationStatus === 'rejected' && '已駁回'}
                </p>
                {rejectionReadonly && (
                  <p style={{ fontSize: '0.85rem', color: '#f85149', margin: '0.5rem 0' }}>
                    上次駁回原因：{rejectionReadonly}
                  </p>
                )}
                <div style={{ marginTop: '0.75rem' }}>
                  <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>
                    實景佐證
                  </p>
                  {proofSignedUrls.length === 0 ? (
                    <p className="muted" style={{ fontSize: '0.85rem' }}>
                      （無圖，或舊庫僅有網址主圖）
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {proofSignedUrls.map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'block', width: '120px', height: '90px' }}
                        >
                          <img
                            src={u}
                            alt="佐證"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 0.25rem' }}>
                    房產證明
                  </p>
                  {deedSignedUrl ? (
                    <a href={deedSignedUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem' }}>
                      開啟檔案（簽名網址，約 1 小時內有效）
                    </a>
                  ) : (
                    <p className="muted" style={{ fontSize: '0.85rem' }}>
                      無
                    </p>
                  )}
                </div>
                {verificationStatus === 'pending' && (
                  <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                    <div>
                      <label className="muted" style={{ display: 'block', fontSize: '0.8rem' }}>
                        駁回原因（僅在駁回時需要）
                      </label>
                      <textarea
                        rows={2}
                        value={rejectDraft}
                        onChange={(e) => setRejectDraft(e.target.value)}
                        placeholder="寫明需補交項目或與實盤不符之處…"
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button type="button" className="btn btn-primary" disabled={verSaving} onClick={() => void verifyApprove()}>
                        {verSaving ? '處理中…' : '核准上架首頁'}
                      </button>
                      <button type="button" className="btn" disabled={verSaving} onClick={() => void verifyReject()}>
                        駁回
                      </button>
                    </div>
                    <p className="muted" style={{ fontSize: '0.75rem' }}>
                      核准後，一般租客才能於 App 首頁看到此盤，並能發起洽詢與申請租約。
                    </p>
                  </div>
                )}
                {verificationStatus !== 'pending' && (
                  <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
                    審核已結案。若業主重傳證明，此租盤會回到「待審」。
                  </p>
                )}
              </>
            )}
          </div>

          <div className="card" style={{ display: 'grid', gap: '0.75rem', maxWidth: '560px' }}>
            <div>
              <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                狀態
              </label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}（{o.value}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                標題
              </label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                地區
              </label>
              <input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  月租（$）
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  面積（呎）
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.area}
                  onChange={(e) => setForm((f) => ({ ...f, area: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  樓層
                </label>
                <input
                  type="number"
                  value={form.floor}
                  onChange={(e) => setForm((f) => ({ ...f, floor: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  房
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.bedrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bedrooms: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  廁
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.bathrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bathrooms: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                圖片 URL
              </label>
              <input value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                描述
              </label>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            {saveOk && (
              <p style={{ color: '#3fb950', fontSize: '0.9rem', margin: 0 }}>
                已儲存。可回到「租盤列表」重新載入確認。
              </p>
            )}
            {err && (
              <p role="alert" style={{ color: '#f85149', fontSize: '0.9rem', margin: saveOk ? '0.5rem 0 0' : 0 }}>
                {err}
              </p>
            )}
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? '儲存中…' : '儲存變更'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
