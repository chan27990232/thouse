import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Row = {
  id: string;
  updated_at: string;
  tenant_display_name: string;
  property_id: string;
  properties: { title: string; district: string } | null;
  landlord: { email: string; full_name: string } | null;
  tenant: { email: string; full_name: string } | null;
};

export function ConversationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setErr('');
      const { data, error } = await supabase
        .from('conversations')
        .select(
          'id, updated_at, tenant_display_name, property_id, properties ( title, district ), landlord:profiles!conversations_landlord_id_fkey ( email, full_name ), tenant:profiles!conversations_tenant_id_fkey ( email, full_name )'
        )
        .order('updated_at', { ascending: false })
        .limit(120);
      if (c) return;
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows(((data as unknown) as Row[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>對話監管</h1>
      <p className="muted">平台內房東與租客的詢價 / 聯絡訊息（僅讀，供客服釐清爭議或違規排查）。</p>
      {err && <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{err}</p>}
      {loading ? (
        <p className="muted">載入中…</p>
      ) : (
        <div className="table-wrap card" style={{ padding: 0, marginTop: '1rem' }}>
          <table className="data">
            <thead>
              <tr>
                <th>物業</th>
                <th>房東</th>
                <th>租客</th>
                <th>最後活動</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: '1.5rem' }}>
                    尚無對話
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.properties?.title ?? r.property_id}
                    <br />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      {r.properties?.district}
                    </span>
                  </td>
                  <td>
                    {r.landlord?.email}
                    <br />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      {r.landlord?.full_name}
                    </span>
                  </td>
                  <td>
                    {r.tenant?.email ?? r.tenant_display_name}
                    <br />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      {r.tenant?.full_name}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: '0.8rem' }}>
                    {r.updated_at?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td>
                    <Link to={'/chats/' + r.id}>內容</Link>
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
