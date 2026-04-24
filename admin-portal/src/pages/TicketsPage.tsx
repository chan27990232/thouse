import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: { email: string; full_name: string; role: string } | null;
};

export function TicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    let q = supabase
      .from('support_tickets')
      .select(
        'id, user_id, subject, status, created_at, updated_at, profiles!support_tickets_user_id_fkey ( email, full_name, role )'
      )
      .order('updated_at', { ascending: false })
      .limit(200);
    if (status) q = q.eq('status', status);
    return q;
  }, [status]);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      const { data, error } = await query;
      if (!c && !error) setRows(((data as unknown) as Ticket[]) ?? []);
      if (!c) setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [query]);

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>客服工單</h1>
      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <span className="muted">狀態</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: '140px' }}>
          <option value="">全部</option>
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="closed">closed</option>
        </select>
      </div>
      {loading ? (
        <p className="muted">載入中…</p>
      ) : (
        <div className="table-wrap card" style={{ padding: 0, marginTop: '1rem' }}>
          <table className="data">
            <thead>
              <tr>
                <th>主題</th>
                <th>用戶</th>
                <th>狀態</th>
                <th>更新</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: '1.5rem' }}>
                    尚無工單
                  </td>
                </tr>
              )}
              {rows.map((t) => {
                const p = t.profiles;
                return (
                  <tr key={t.id}>
                    <td>{t.subject}</td>
                    <td>
                      {p?.email ?? t.user_id}
                      <br />
                      <span className="muted" style={{ fontSize: '0.75rem' }}>
                        {p?.full_name} · {p?.role}
                      </span>
                    </td>
                    <td>
                      <span className={'badge ' + (t.status === 'closed' ? 'closed' : 'open')}>{t.status}</span>
                    </td>
                    <td className="muted" style={{ fontSize: '0.8rem' }}>
                      {t.updated_at?.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td>
                      <Link to={'/tickets/' + t.id}>回覆</Link>
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
