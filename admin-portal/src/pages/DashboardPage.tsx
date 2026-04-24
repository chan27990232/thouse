import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function DashboardPage() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [openTickets, setOpenTickets] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { count: uc } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      const { count: tc } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);
      if (!cancel) {
        setUserCount(uc ?? 0);
        setOpenTickets(tc ?? 0);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>總覽</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        監管註冊用戶、處理客服工單、檢視租客與業主站內對話（唯讀）。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            用戶總數
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, marginTop: '0.25rem' }}>{userCount ?? '—'}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            待辦工單
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, marginTop: '0.25rem' }}>{openTickets ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
