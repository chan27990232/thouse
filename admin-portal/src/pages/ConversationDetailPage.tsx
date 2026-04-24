import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Ctx = {
  id: string;
  properties: { title: string; district: string } | null;
  landlord: { email: string; full_name: string } | null;
  tenant: { email: string; full_name: string } | null;
  tenant_display_name: string;
};

type Msg = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  read_at: string | null;
  profiles: { email: string; full_name: string } | null;
};

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    let c = false;
    (async () => {
      setErr('');
      const { data: conv, error: e1 } = await supabase
        .from('conversations')
        .select(
          'id, tenant_display_name, properties ( title, district ), landlord:profiles!conversations_landlord_id_fkey ( email, full_name ), tenant:profiles!conversations_tenant_id_fkey ( email, full_name )'
        )
        .eq('id', id)
        .single();
      if (c) return;
      if (e1 || !conv) {
        setErr(e1?.message ?? '找不到對話');
        return;
      }
      setCtx(conv as unknown as Ctx);

      const { data: m, error: e2 } = await supabase
        .from('conversation_messages')
        .select('id, body, created_at, sender_id, read_at, profiles!conversation_messages_sender_id_fkey ( email, full_name )')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (!c && !e2 && m) setMsgs(m as unknown as Msg[]);
      if (e2) setErr((prev) => (prev ? prev + '；' : '') + e2.message);
    })();
    return () => {
      c = true;
    };
  }, [id]);

  if (!id) return <Navigate to="/chats" replace />;

  if (err && !ctx) {
    return (
      <div>
        <p>
          <Link to="/chats">← 返回</Link>
        </p>
        <p className="muted">{err}</p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link to="/chats">← 返回對話列表</Link>
      </p>
      {ctx && (
        <>
          <h1 style={{ marginTop: '0.5rem', fontSize: '1.25rem' }}>{ctx.properties?.title ?? '對話'}</h1>
          <p className="muted">
            {ctx.properties?.district} · 房東 {ctx.landlord?.email} · 租客 {ctx.tenant?.email ?? ctx.tenant_display_name}
          </p>
        </>
      )}

      <h2 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>訊息</h2>
      <div className="msg-list conv-readonly" style={{ maxHeight: 'min(60vh, 480px)' }}>
        {msgs.map((m) => {
          const who = m.profiles?.email ?? m.sender_id.slice(0, 8);
          const name = m.profiles?.full_name;
          return (
            <div key={m.id} className="msg user">
              <div>
                {name && (
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    {name} ·{' '}
                  </span>
                )}
                {who}
              </div>
              <div style={{ marginTop: '0.25rem' }}>{m.body}</div>
              <div className="meta">
                {m.created_at?.slice(0, 16).replace('T', ' ')}
                {m.read_at && ' · 已讀 ' + m.read_at.slice(0, 16).replace('T', ' ')}
              </div>
            </div>
          );
        })}
        {msgs.length === 0 && !err && <p className="muted">尚無訊息</p>}
      </div>
      {err && ctx && <p className="muted" style={{ fontSize: '0.85rem' }}>{err}</p>}
    </div>
  );
}
