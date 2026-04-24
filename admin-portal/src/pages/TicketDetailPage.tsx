import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Msg = {
  id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
  sender_id: string;
};

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  profiles: { email: string; full_name: string } | null;
};

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    if (!id) return;
    const { data: t, error: e1 } = await supabase
      .from('support_tickets')
      .select('id, user_id, subject, status, created_at, profiles!support_tickets_user_id_fkey ( email, full_name )')
      .eq('id', id)
      .single();
    if (e1 || !t) {
      setErr(e1?.message ?? '找不到工單');
      return;
    }
    setTicket(t as unknown as Ticket);
    setStatus((t as { status: string }).status);

    const { data: m, error: e2 } = await supabase
      .from('support_messages')
      .select('id, body, is_staff, created_at, sender_id')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });
    if (!e2 && m) setMsgs(m as unknown as Msg[]);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function sendReply() {
    const text = body.trim();
    if (!text || !id) return;
    setSending(true);
    setErr('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr('未登入');
      setSending(false);
      return;
    }
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: id,
      sender_id: user.id,
      is_staff: true,
      body: text,
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setBody('');
    void load();
  }

  async function saveStatus(next: string) {
    if (!id) return;
    const { error } = await supabase.from('support_tickets').update({ status: next }).eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setStatus(next);
    void load();
  }

  if (!id) return <Navigate to="/tickets" replace />;
  if (err && !ticket) return <p className="muted">{err}</p>;

  return (
    <div>
      <p>
        <Link to="/tickets">← 返回工單列表</Link>
      </p>
      {ticket && (
        <>
          <h1 style={{ marginTop: '0.5rem', fontSize: '1.35rem' }}>{ticket.subject}</h1>
          <p className="muted">
            用戶：{ticket.profiles?.email ?? ticket.user_id} {ticket.profiles?.full_name ? `（${ticket.profiles.full_name}）` : ''}
          </p>
          <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted">工單狀態</span>
            <select value={status} onChange={(e) => void saveStatus(e.target.value)}>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="closed">closed</option>
            </select>
          </div>

          <h2 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>對話</h2>
          <div className="msg-list">
            {msgs.map((m) => (
              <div key={m.id} className={'msg ' + (m.is_staff ? 'staff' : 'user')}>
                <div>{m.body}</div>
                <div className="meta">
                  {m.is_staff ? '客服' : '用戶'} · {m.created_at?.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
            ))}
            {msgs.length === 0 && <p className="muted">尚無訊息</p>}
          </div>

          {err && <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{err}</p>}

          <div className="card">
            <label htmlFor="rep" className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
              回覆用戶
            </label>
            <textarea
              id="rep"
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="輸入內部處理進度、指引或解決方式…"
            />
            <button type="button" className="btn btn-primary" style={{ marginTop: '0.75rem' }} disabled={sending || !body.trim()} onClick={() => void sendReply()}>
              {sending ? '送出中…' : '送出回覆'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
