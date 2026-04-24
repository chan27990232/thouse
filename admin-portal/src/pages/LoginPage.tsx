import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function LoginPage({ onSession }: { onSession: () => void }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const id = userId.trim();
    if (!id) {
      setErr('請輸入用戶 ID。');
      return;
    }
    setSubmitting(true);
    const { data: email, error: rpcError } = await supabase.rpc('resolve_password_login_email', {
      p_login: id,
    });
    if (rpcError || !email || typeof email !== 'string') {
      setErr('帳號或密碼錯誤。');
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setErr('帳號或密碼錯誤。');
      return;
    }
    onSession();
  }

  return (
    <div className="login-box">
      <h1>管理後台登入</h1>
      <p>輸入主站帳戶的用戶名（username）或 profiles 的 UUID，以及密碼。帳戶需已寫入 app_admins。</p>
      <form onSubmit={handle}>
        <label htmlFor="a-userid">用戶 ID</label>
        <input
          id="a-userid"
          type="text"
          name="userId"
          autoComplete="username"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="用戶名 或 8-4-4-4-12 格式的 UUID"
          required
        />
        <label htmlFor="a-pw">密碼</label>
        <input
          id="a-pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <p style={{ color: '#f85149', fontSize: '0.85rem' }}>{err}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '0.5rem' }}
          disabled={submitting}
        >
          {submitting ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  );
}
