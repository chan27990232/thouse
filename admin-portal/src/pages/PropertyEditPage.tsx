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

  /** 表單 number 可能為 NaN；寫入 integer 欄位前必須收斂，否則 PostgREST 更新會失敗且難以察覺 */
  function safeNonNegInt(n: number, fallback: number) {
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  }

  function safePositiveInt(n: number, min: number) {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.floor(n));
  }

  const dbNoRowMsg =
    '沒有更新到任何資料列：多為 RLS 未允許（請在 Supabase 執行 supabase/admin_properties_write.sql，並確認此登入帳號已寫入 app_admins）。';

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
    const { data: updatedRows, error } = await supabase
      .from('properties')
      .update({
        landlord_id: lid,
        title: form.title.trim() || '未命名',
        image: form.image.trim(),
        price: safeNonNegInt(form.price, 0),
        area: safeNonNegInt(form.area, 0),
        floor: safeNonNegInt(form.floor, 0),
        bedrooms: safePositiveInt(form.bedrooms, 1),
        bathrooms: safePositiveInt(form.bathrooms, 1),
        district: form.district.trim(),
        description: form.description,
        status: form.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id');
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
    if (!updatedRows?.length) {
      setErr(dbNoRowMsg);
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
    const { data: updatedRows, error } = await supabase
      .from('properties')
      .update({
        verification_status: 'approved',
        verification_rejected_reason: '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id');
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
    if (!updatedRows?.length) {
      setErr(dbNoRowMsg);
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
    const { data: updatedRows, error } = await supabase
      .from('properties')
      .update({
        verification_status: 'rejected',
        verification_rejected_reason: rejectDraft.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id');
    setVerSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (!updatedRows?.length) {
      setErr(dbNoRowMsg);
      return;
    }
    setVerificationStatus('rejected');
    setRejectionReadonly(rejectDraft.trim());
    const line = '已送出駁回。業主可於 App 內看到原因；若重傳證明，此盤會回到待審。';
    setVerifySuccessMsg(line);
    window.alert(`已駁回\n\n${line}`);
  }

  const fieldInputClass =
    'mt-1.5 block w-full min-h-11 rounded-lg border border-slate-600 bg-[#0d1117] px-3 py-2.5 text-sm text-slate-100 shadow-sm placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50';

  if (loadFailed) {
    return (
      <div className="mx-auto w-full max-w-lg px-1 py-1 sm:px-0">
        <Link
          to="/properties"
          className="text-sm text-sky-400 transition hover:text-sky-300 hover:underline"
        >
          ← 租盤列表
        </Link>
        <p className="mt-3 text-sm text-slate-400">{err}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4 sm:space-y-6">
      <header className="space-y-1">
        <Link
          to="/properties"
          className="inline-flex text-sm text-sky-400 transition hover:text-sky-300 hover:underline"
        >
          ← 租盤列表
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">編輯租盤</h1>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">載入中…</p>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {err ? (
            <div
              role="alert"
              className="rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-2.5 text-sm leading-relaxed text-red-200 sm:px-4"
            >
              {err}
            </div>
          ) : null}

          <section
            className="rounded-2xl border border-slate-700/80 bg-[#161b22] p-4 shadow-sm sm:p-5"
            aria-labelledby="landlord-heading"
          >
            <h2 id="landlord-heading" className="text-sm font-medium text-slate-200 sm:text-base">
              業主（房東用戶）
            </h2>
            <label htmlFor="landlord-id" className="mt-2 block text-xs text-slate-400 sm:mt-3 sm:text-[0.8125rem]">
              業主 user id（= <code className="rounded bg-slate-800 px-1 py-0.5 text-[0.7rem] sm:text-xs">landlord_id</code>{' '}
              = 用戶頁的 UUID，例如{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-[0.7rem] sm:text-xs">landlord@thouse.local</code> 一列）
            </label>
            <input
              id="landlord-id"
              className={`${fieldInputClass} font-mono text-xs sm:text-sm`}
              value={landlordIdEdit}
              onChange={(e) => setLandlordIdEdit(e.target.value)}
              placeholder="1e2e499b-d642-433d-a728-086ecc0bb331"
            />
            {landlord ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-200 sm:text-[0.95rem]">
                {landlord.full_name || '—'} · {landlord.email || '（無 email）'}
                <br />
                <span className="text-slate-500">
                  身份：{landlord.role}
                  {landlord.phone ? ` · 電話：${landlord.phone}` : ''}
                </span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {landlordIdEdit.trim()
                  ? '此 UUID 在 profiles 查無資料，儲存後若仍顯示此句請確認用戶已註冊'
                  : '貼上房東的 UUID 後儲存租盤即可掛在該用戶名下'}
              </p>
            )}
            <p className="mb-0 mt-3 text-xs text-slate-500 sm:mt-4">與「用戶」頁該行 UUID 必須一致，租盤才歸屬該帳戶。</p>
          </section>

          <section
            className="rounded-2xl border border-slate-700/80 bg-[#161b22] p-4 shadow-sm sm:p-5"
            aria-labelledby="verify-heading"
          >
            <h2 id="verify-heading" className="text-sm font-medium text-slate-200 sm:text-base">
              實名審核
            </h2>
            {verifySuccessMsg && (
              <p
                role="status"
                className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200 sm:mt-4"
              >
                {verifySuccessMsg}
              </p>
            )}
            {verificationStatus == null && (
              <p className="mt-3 text-sm text-slate-500 sm:mt-4">
                庫內若尚無審核欄位，請在 Supabase 執行{' '}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">property_listing_verification.sql</code>。
              </p>
            )}
            {verificationStatus != null && (
              <div className="mt-3 space-y-4 sm:mt-4">
                <p className="text-sm text-slate-200">
                  狀態：
                  {verificationStatus === 'pending' && '待審核'}
                  {verificationStatus === 'approved' && '已核准上首頁'}
                  {verificationStatus === 'rejected' && '已駁回'}
                </p>
                {rejectionReadonly && (
                  <p className="text-sm leading-relaxed text-red-300 sm:text-[0.9rem]">上次駁回原因：{rejectionReadonly}</p>
                )}
                <div>
                  <p className="text-xs font-medium text-slate-500">實景佐證</p>
                  {proofSignedUrls.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-500">（無圖，或舊庫僅有網址主圖）</p>
                  ) : (
                    <ul className="mt-2 grid list-none grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3" role="list">
                      {proofSignedUrls.map((u) => (
                        <li key={u} className="min-w-0">
                          <a
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-slate-700/80 transition hover:ring-sky-500/50"
                          >
                            <img src={u} alt="佐證" className="h-full w-full object-cover" loading="lazy" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">房產證明</p>
                  {deedSignedUrl ? (
                    <a
                      href={deedSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-block text-sm text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      開啟檔案（簽名網址，約 1 小時內有效）
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">無</p>
                  )}
                </div>
                {verificationStatus === 'pending' && (
                  <div className="space-y-3 border-t border-slate-700/60 pt-4 sm:space-y-4 sm:pt-5">
                    <div>
                      <label htmlFor="reject-reason" className="text-xs text-slate-500">
                        駁回原因（僅在駁回時需要）
                      </label>
                      <textarea
                        id="reject-reason"
                        rows={2}
                        className={`${fieldInputClass} resize-y`}
                        value={rejectDraft}
                        onChange={(e) => setRejectDraft(e.target.value)}
                        placeholder="寫明需補交項目或與實盤不符之處…"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                      <button
                        type="button"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        disabled={verSaving}
                        onClick={() => void verifyApprove()}
                      >
                        {verSaving ? '處理中…' : '核准上架首頁'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-4 text-sm font-medium text-slate-200 shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        disabled={verSaving}
                        onClick={() => void verifyReject()}
                      >
                        駁回
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      核准後，一般租客才能於 App 首頁看到此盤，並能發起洽詢與申請租約。
                    </p>
                  </div>
                )}
                {verificationStatus !== 'pending' && (
                  <p className="text-xs text-slate-500 sm:text-sm">審核已結案。若業主重傳證明，此租盤會回到「待審」。</p>
                )}
              </div>
            )}
          </section>

          <section
            className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-700/80 bg-[#161b22] p-4 shadow-sm sm:gap-5 sm:p-5"
            aria-labelledby="listing-heading"
          >
            <h2 id="listing-heading" className="text-sm font-medium text-slate-200 sm:text-base">
              租盤內容
            </h2>
            <div>
              <label htmlFor="status" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                狀態
              </label>
              <select
                id="status"
                className={fieldInputClass}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}（{o.value}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="title" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                標題
              </label>
              <input
                id="title"
                className={fieldInputClass}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="district" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                地區
              </label>
              <input
                id="district"
                className={fieldInputClass}
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
              <div>
                <label htmlFor="price" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                  月租（$）
                </label>
                <input
                  id="price"
                  type="number"
                  min={0}
                  className={fieldInputClass}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label htmlFor="area" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                  面積（呎）
                </label>
                <input
                  id="area"
                  type="number"
                  min={0}
                  className={fieldInputClass}
                  value={form.area}
                  onChange={(e) => setForm((f) => ({ ...f, area: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-4">
              <div>
                <label htmlFor="floor" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                  樓層
                </label>
                <input
                  id="floor"
                  type="number"
                  className={fieldInputClass}
                  value={form.floor}
                  onChange={(e) => setForm((f) => ({ ...f, floor: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label htmlFor="bedrooms" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                  房
                </label>
                <input
                  id="bedrooms"
                  type="number"
                  min={1}
                  className={fieldInputClass}
                  value={form.bedrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bedrooms: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label htmlFor="bathrooms" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                  廁
                </label>
                <input
                  id="bathrooms"
                  type="number"
                  min={1}
                  className={fieldInputClass}
                  value={form.bathrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bathrooms: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <label htmlFor="image" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                圖片 URL
              </label>
              <input
                id="image"
                className={fieldInputClass}
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-xs text-slate-500 sm:text-[0.8125rem]">
                描述
              </label>
              <textarea
                id="description"
                rows={5}
                className={`${fieldInputClass} min-h-32 resize-y`}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {saveOk && !err && (
              <p className="text-sm text-emerald-400">已儲存。可回到「租盤列表」重新載入確認。</p>
            )}
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50 sm:w-full sm:max-w-xs"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? '儲存中…' : '儲存變更'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
