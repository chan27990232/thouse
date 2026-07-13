import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type IdentitySubmission = {
  legal_name: string;
  id_number: string;
  date_of_birth: string | null;
  id_card_path: string;
  bank_statement_paths: string[];
  bank_statement_months: string[];
  created_at: string;
};

type SubmissionLinks = {
  idCardUrl: string | null;
  bankUrls: (string | null)[];
  submission: IdentitySubmission;
};

type Row = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  phone: string;
  salutation: string;
  response_time: string;
  is_verified: boolean;
  is_deactivated: boolean;
  deactivated_original_username: string | null;
  created_at: string;
  landlord_verification_status: string | null;
  landlord_verification_rejection_reason: string | null;
  landlord_verification_submitted_at: string | null;
  tenant_verification_status: string | null;
  tenant_verification_rejection_reason: string | null;
  tenant_verification_submitted_at: string | null;
};

type UserDraft = {
  full_name: string;
  phone: string;
  salutation: string;
  response_time: string;
  is_verified: boolean;
};

type Rejecting = { id: string; reason: string; kind: 'landlord' | 'tenant' };
type ConfirmAction = 'save' | 'deactivate' | 'reactivate' | 'discard';

const PROFILE_SELECT =
  'id, email, username, full_name, role, phone, salutation, response_time, is_verified, is_deactivated, deactivated_original_username, created_at, landlord_verification_status, landlord_verification_rejection_reason, landlord_verification_submitted_at, tenant_verification_status, tenant_verification_rejection_reason, tenant_verification_submitted_at';

function rowToDraft(r: Row): UserDraft {
  return {
    full_name: r.full_name ?? '',
    phone: r.phone ?? '',
    salutation: r.salutation ?? '',
    response_time: r.response_time ?? '',
    is_verified: Boolean(r.is_verified),
  };
}

function draftsEqual(a: UserDraft, b: UserDraft) {
  return (
    a.full_name === b.full_name &&
    a.phone === b.phone &&
    a.salutation === b.salutation &&
    a.response_time === b.response_time &&
    a.is_verified === b.is_verified
  );
}

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
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [identitySubmission, setIdentitySubmission] = useState<SubmissionLinks | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) {
      setRows(data as Row[]);
    } else if (error?.message?.includes('is_deactivated')) {
      const fallbackSelect = PROFILE_SELECT.replace(', is_deactivated', '');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .select(fallbackSelect)
        .order('created_at', { ascending: false })
        .limit(500);
      if (!fallbackError && fallbackData) {
        setRows(
          (fallbackData as Omit<Row, 'is_deactivated'>[]).map((r) => ({
            ...r,
            is_deactivated: false,
          })),
        );
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const originalDraft = useMemo(() => (editing ? rowToDraft(editing) : null), [editing]);
  const isDirty = Boolean(editing && draft && originalDraft && !draftsEqual(draft, originalDraft));

  const resetConfirm = () => {
    setConfirmAction(null);
    setConfirmText('');
  };

  const openEdit = (row: Row) => {
    setActionError('');
    resetConfirm();
    setEditing(row);
    setDraft(rowToDraft(row));
    setIdentitySubmission(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setDraft(null);
    setIdentitySubmission(null);
    resetConfirm();
  };

  const requestCloseEdit = () => {
    if (isDirty) {
      setConfirmAction('discard');
      setConfirmText('');
      return;
    }
    closeEdit();
  };

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

  const saveProfile = async () => {
    if (!editing || !draft) return;
    setActionError('');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: draft.full_name.trim(),
          phone: draft.phone.trim(),
          salutation: draft.salutation,
          response_time: draft.response_time.trim(),
          is_verified: draft.is_verified,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);
      if (error) throw new Error(error.message);
      resetConfirm();
      closeEdit();
      await loadRows();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const setDeactivated = async (deactivated: boolean) => {
    if (!editing) return;
    setActionError('');
    setSaving(true);
    try {
      const rpcName = deactivated ? 'admin_archive_deactivated_user' : 'admin_reactivate_user';
      const { error } = await supabase.rpc(rpcName, { target_id: editing.id });
      if (error) {
        if (String(error.message).includes('is_deactivated') || String(error.message).includes('deactivated_original_username')) {
          throw new Error(
            '資料庫尚未更新註銷功能。請在專根執行：node scripts/apply-database.mjs admin_profile_deactivate.sql',
          );
        }
        if (String(error.message).includes('admin_archive_deactivated_user') || String(error.message).includes('admin_reactivate_user')) {
          throw new Error(
            '資料庫尚未建立註銷 RPC。請在專根執行：node scripts/apply-database.mjs admin_profile_deactivate.sql',
          );
        }
        throw new Error(error.message);
      }
      resetConfirm();
      closeEdit();
      await loadRows();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : deactivated ? '註銷失敗' : '恢復失敗');
    } finally {
      setSaving(false);
    }
  };

  const emailMatchesConfirm = editing
    ? confirmText.trim().toLowerCase() === editing.email.trim().toLowerCase()
    : false;

  const handlePrimaryConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction === 'save') {
      void saveProfile();
      return;
    }
    if (confirmAction === 'discard') {
      closeEdit();
      return;
    }
    if (confirmAction === 'deactivate' && emailMatchesConfirm) {
      void setDeactivated(true);
      return;
    }
    if (confirmAction === 'reactivate' && emailMatchesConfirm) {
      void setDeactivated(false);
    }
  };

  useEffect(() => {
    if (!editing) return;
    const pending =
      (editing.role === 'tenant' && (editing.tenant_verification_status ?? 'none') === 'pending') ||
      (editing.role === 'landlord' && (editing.landlord_verification_status ?? 'none') === 'pending');
    if (!pending) {
      setIdentitySubmission(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIdentityLoading(true);
      try {
        const { data, error } = await supabase
          .from('identity_verification_submissions')
          .select(
            'legal_name, id_number, date_of_birth, id_card_path, bank_statement_paths, bank_statement_months, created_at',
          )
          .eq('user_id', editing.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || error || !data) {
          if (!cancelled) setIdentitySubmission(null);
          return;
        }
        const submission = data as IdentitySubmission;
        const idRes = await supabase.storage
          .from('identity-verification')
          .createSignedUrl(submission.id_card_path, 3600);
        const bankUrls = await Promise.all(
          (submission.bank_statement_paths ?? []).map(async (path) => {
            const { data: signed } = await supabase.storage
              .from('identity-verification')
              .createSignedUrl(path, 3600);
            return signed?.signedUrl ?? null;
          }),
        );
        if (!cancelled) {
          setIdentitySubmission({
            submission,
            idCardUrl: idRes.data?.signedUrl ?? null,
            bankUrls,
          });
        }
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      r.email.toLowerCase().includes(t) ||
      (r.full_name && r.full_name.toLowerCase().includes(t)) ||
      (r.username && r.username.toLowerCase().includes(t)) ||
      r.id.toLowerCase().includes(t)
    );
  });

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>用戶</h1>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        讀取 profiles（RLS：管理員專用）。可編輯基本資料；註銷會釋放登入帳號，該用戶可重新註冊。實名驗證：業主或租客狀態為「待審」時可核准或駁回。需先套用{' '}
        <code>admin_profile_deactivate.sql</code>。
      </p>
      {actionError ? (
        <p style={{ color: 'crimson', marginBottom: '0.75rem' }}>{actionError}</p>
      ) : null}
      {editing && draft ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>編輯用戶資料</p>
          <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>
            {editing.email} · {editing.username || '—'} · {editing.role}
            {editing.is_deactivated && editing.deactivated_original_username ? (
              <span style={{ marginLeft: '0.5rem' }}>
                （原帳號：{editing.deactivated_original_username}）
              </span>
            ) : null}
            {editing.is_deactivated ? (
              <span className="badge inactive" style={{ marginLeft: '0.5rem' }}>
                已註銷
              </span>
            ) : null}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                姓名
              </span>
              <input
                type="text"
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                電話
              </span>
              <input
                type="text"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                稱謂
              </span>
              <select
                value={draft.salutation}
                onChange={(e) => setDraft({ ...draft, salutation: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="">—</option>
                <option value="先生">先生</option>
                <option value="女士">女士</option>
                <option value="不便透露">不便透露</option>
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                回覆時間
              </span>
              <input
                type="text"
                value={draft.response_time}
                onChange={(e) => setDraft({ ...draft, response_time: e.target.value })}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={draft.is_verified}
                onChange={(e) => setDraft({ ...draft, is_verified: e.target.checked })}
              />
              <span style={{ fontSize: '0.85rem' }}>已認證 (is_verified)</span>
            </label>
          </div>

          {identityLoading ? (
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              載入實名驗證資料…
            </p>
          ) : identitySubmission ? (
            <div
              className="card"
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: '#1a2332',
                border: '1px solid #334155',
              }}
            >
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>實名驗證提交資料</p>
              <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
                證件姓名：{identitySubmission.submission.legal_name} · 身份證：{identitySubmission.submission.id_number}
                {identitySubmission.submission.date_of_birth
                  ? ` · 出生：${identitySubmission.submission.date_of_birth}`
                  : ''}
              </p>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
                {identitySubmission.idCardUrl ? (
                  <a href={identitySubmission.idCardUrl} target="_blank" rel="noreferrer">
                    查看身份證
                  </a>
                ) : (
                  <span className="muted">身份證連結無法產生</span>
                )}
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem' }}>
                {identitySubmission.submission.bank_statement_paths.map((_, i) => (
                  <li key={i}>
                    {(identitySubmission.submission.bank_statement_months[i]?.trim() || '銀行月結單')}：
                    {identitySubmission.bankUrls[i] ? (
                      <a href={identitySubmission.bankUrls[i]!} target="_blank" rel="noreferrer">
                        查看
                      </a>
                    ) : (
                      <span className="muted"> 無法產生連結</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {confirmAction ? (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #842626',
                background: '#2d1f1f',
              }}
            >
              {confirmAction === 'save' ? (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
                  請再次確認儲存以下變更（二次確認）。
                </p>
              ) : null}
              {confirmAction === 'discard' ? (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
                  有未儲存的變更。請再次確認要放棄編輯（二次確認）。
                </p>
              ) : null}
              {confirmAction === 'deactivate' ? (
                <>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#ff7b72' }}>
                    註銷後將釋放登入帳號，該用戶可重新註冊。請輸入用戶 Email 以完成二次確認：
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={editing.email}
                    style={{ width: '100%', maxWidth: '360px', marginBottom: '0.5rem' }}
                  />
                </>
              ) : null}
              {confirmAction === 'reactivate' ? (
                <>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
                    恢復帳戶後用戶可再次使用。請輸入用戶 Email 以完成二次確認：
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={editing.email}
                    style={{ width: '100%', maxWidth: '360px', marginBottom: '0.5rem' }}
                  />
                </>
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={confirmAction === 'deactivate' ? 'btn btn-danger' : 'btn btn-primary'}
                  disabled={
                    saving ||
                    ((confirmAction === 'deactivate' || confirmAction === 'reactivate') && !emailMatchesConfirm)
                  }
                  onClick={() => handlePrimaryConfirm()}
                >
                  {confirmAction === 'save'
                    ? '確認儲存'
                    : confirmAction === 'discard'
                      ? '確認放棄'
                      : confirmAction === 'deactivate'
                        ? '確認註銷'
                        : '確認恢復'}
                </button>
                <button type="button" className="btn" disabled={saving} onClick={resetConfirm}>
                  取消
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || !isDirty}
              onClick={() => {
                setActionError('');
                setConfirmAction('save');
                setConfirmText('');
              }}
            >
              儲存變更
            </button>
            <button type="button" className="btn" disabled={saving} onClick={requestCloseEdit}>
              關閉
            </button>
            {editing.is_deactivated ? (
              <button
                type="button"
                className="btn"
                disabled={saving}
                onClick={() => {
                  setActionError('');
                  setConfirmAction('reactivate');
                  setConfirmText('');
                }}
              >
                恢復帳戶
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => {
                  setActionError('');
                  setConfirmAction('deactivate');
                  setConfirmText('');
                }}
              >
                註銷帳戶
              </button>
            )}
          </div>
        </div>
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
                <th>狀態</th>
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
                  <tr key={r.id} style={r.is_deactivated ? { opacity: 0.65 } : undefined}>
                    <td>{r.email}</td>
                    <td>{r.full_name || '—'}</td>
                    <td>{r.role}</td>
                    <td>
                      {r.is_deactivated ? (
                        <span className="badge inactive">已註銷</span>
                      ) : (
                        <span className="badge open">正常</span>
                      )}
                    </td>
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
                      <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={verifying || saving}
                          onClick={() => openEdit(r)}
                        >
                          編輯
                        </button>
                        {lPending ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={verifying}
                              onClick={() => void approve(r.id, 'landlord')}
                            >
                              核准(業主)
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={verifying}
                              onClick={() => setRejecting({ id: r.id, reason: '', kind: 'landlord' })}
                            >
                              駁回(業主)
                            </button>
                          </>
                        ) : null}
                        {tPending ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={verifying}
                              onClick={() => void approve(r.id, 'tenant')}
                            >
                              核准(租客)
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={verifying}
                              onClick={() => setRejecting({ id: r.id, reason: '', kind: 'tenant' })}
                            >
                              駁回(租客)
                            </button>
                          </>
                        ) : null}
                      </span>
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
