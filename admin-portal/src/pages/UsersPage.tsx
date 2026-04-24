import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Row = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string;
  is_verified: boolean;
  created_at: string;
};

export function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, phone, is_verified, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!c && !error && data) setRows(data as Row[]);
      if (!c) setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, []);

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
        讀取 profiles（RLS：管理員專用）。可搜尋 email／姓名／UUID。
      </p>
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
                <th>電話</th>
                <th>認證</th>
                <th>註冊</th>
                <th>UUID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.full_name || '—'}</td>
                  <td>{r.role}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.is_verified ? '是' : '否'}</td>
                  <td className="muted">{r.created_at?.slice(0, 10)}</td>
                  <td className="muted" style={{ fontSize: '0.7rem' }}>
                    {r.id}
                  </td>
                </tr>
              ))}
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
