import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Search, Send } from 'lucide-react';
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

type Msg = {
  id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
  sender_id: string;
};

type TicketPreview = Ticket & {
  lastMessageBody: string;
  lastMessageAt: string;
  hasUnreadFromUser: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  open: '待處理',
  in_progress: '處理中',
  closed: '已結束',
};

function formatListTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-HK', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function firstLine(text: string) {
  return text.split('\n').find((l) => l.trim())?.trim() ?? text.slice(0, 80);
}

function avatarText(name: string) {
  return name.replace(/[（）()]/g, '').slice(0, 1) || '客';
}

export function TicketsPage() {
  const { id: selectedId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [rows, setRows] = useState<TicketPreview[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState('');

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ticketStatus, setTicketStatus] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState('');

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListErr('');
    let q = supabase
      .from('support_tickets')
      .select(
        'id, user_id, subject, status, created_at, updated_at, profiles!support_tickets_user_id_fkey ( email, full_name, role )'
      )
      .order('updated_at', { ascending: false })
      .limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);

    const { data, error } = await q;
    if (error) {
      setListErr(error.message);
      setRows([]);
      setListLoading(false);
      return;
    }

    const tickets = ((data as unknown) as Ticket[]) ?? [];
    const ids = tickets.map((t) => t.id);
    const previewMap = new Map<string, { body: string; at: string; is_staff: boolean }>();

    if (ids.length > 0) {
      const { data: msgRows } = await supabase
        .from('support_messages')
        .select('ticket_id, body, created_at, is_staff')
        .in('ticket_id', ids)
        .order('created_at', { ascending: false });

      for (const m of msgRows ?? []) {
        const tid = (m as { ticket_id: string }).ticket_id;
        if (!previewMap.has(tid)) {
          previewMap.set(tid, {
            body: (m as { body: string }).body,
            at: (m as { created_at: string }).created_at,
            is_staff: (m as { is_staff: boolean }).is_staff,
          });
        }
      }
    }

    setRows(
      tickets.map((t) => {
        const preview = previewMap.get(t.id);
        return {
          ...t,
          lastMessageBody: preview?.body ?? '',
          lastMessageAt: preview?.at ?? t.updated_at,
          hasUnreadFromUser: preview ? !preview.is_staff : false,
        };
      })
    );
    setListLoading(false);
  }, [statusFilter]);

  const loadChat = useCallback(async (ticketId: string) => {
    setMsgLoading(true);
    setChatErr('');
    const { data: t, error: e1 } = await supabase
      .from('support_tickets')
      .select('id, user_id, subject, status, created_at, updated_at, profiles!support_tickets_user_id_fkey ( email, full_name, role )')
      .eq('id', ticketId)
      .single();

    if (e1 || !t) {
      setChatErr(e1?.message ?? '找不到對話');
      setTicket(null);
      setMsgs([]);
      setMsgLoading(false);
      return;
    }

    setTicket(t as unknown as Ticket);
    setTicketStatus((t as { status: string }).status);

    const { data: m, error: e2 } = await supabase
      .from('support_messages')
      .select('id, body, is_staff, created_at, sender_id')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (e2) setChatErr(e2.message);
    else setMsgs((m as unknown as Msg[]) ?? []);
    setMsgLoading(false);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setTicket(null);
      setMsgs([]);
      return;
    }
    void loadChat(selectedId);
  }, [selectedId, loadChat]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => {
      const p = t.profiles;
      const hay = [t.subject, p?.email, p?.full_name, p?.role].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const totalUnread = rows.filter((r) => r.hasUnreadFromUser).length;
  const chatVisible = Boolean(selectedId);
  const peerLabel = ticket?.profiles?.full_name?.trim() || ticket?.profiles?.email || '租客';

  const selectTicket = (id: string) => {
    navigate(`/tickets/${id}`);
  };

  const clearSelection = () => {
    navigate('/tickets');
  };

  async function sendReply() {
    const text = body.trim();
    if (!text || !selectedId) return;
    setSending(true);
    setChatErr('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setChatErr('未登入');
      setSending(false);
      return;
    }
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: selectedId,
      sender_id: user.id,
      is_staff: true,
      body: text,
    });
    setSending(false);
    if (error) {
      setChatErr(error.message);
      return;
    }
    setBody('');
    await loadChat(selectedId);
    await loadList();
  }

  async function saveStatus(next: string) {
    if (!selectedId) return;
    const { error } = await supabase.from('support_tickets').update({ status: next }).eq('id', selectedId);
    if (error) {
      setChatErr(error.message);
      return;
    }
    setTicketStatus(next);
    await loadList();
  }

  return (
    <div className="support-chat-shell">
      <div className="support-chat-layout">
        <aside className={`support-inbox ${chatVisible ? 'support-inbox--hidden-mobile' : ''}`}>
          <div className="support-inbox-head">
            <div className="support-inbox-title-row">
              <div>
                <h2 className="support-inbox-title">客服對話</h2>
                <p className="muted" style={{ margin: 0, fontSize: '0.75rem' }}>
                  {listLoading ? '載入中…' : totalUnread > 0 ? `${totalUnread} 待回覆` : '沒有待回覆'}
                </p>
              </div>
            </div>
            <div className="support-inbox-filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="狀態篩選">
                <option value="">全部狀態</option>
                <option value="open">待處理</option>
                <option value="in_progress">處理中</option>
                <option value="closed">已結束</option>
              </select>
            </div>
            <div className="support-search-wrap">
              <Search className="support-search-icon" aria-hidden />
              <input
                type="search"
                className="support-search-input"
                placeholder="搜尋租客或主題"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="support-inbox-list">
            {listErr ? <p className="support-list-empty" style={{ color: '#f85149' }}>{listErr}</p> : null}
            {listLoading && filteredRows.length === 0 ? <p className="support-list-empty">載入中…</p> : null}
            {!listLoading && filteredRows.length === 0 ? <p className="support-list-empty">尚無對話</p> : null}
            {filteredRows.map((t) => {
              const p = t.profiles;
              const label = p?.full_name?.trim() || p?.email || '租客';
              const isActive = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`support-thread-btn ${isActive ? 'support-thread-btn--active' : ''}`}
                  onClick={() => selectTicket(t.id)}
                >
                  <div className="support-thread-inner">
                    <div className="support-avatar">{avatarText(label)}</div>
                    <div className="support-thread-body">
                      <div className="support-thread-top">
                        <p className="support-thread-name">{label}</p>
                        <span className="support-thread-time">{formatListTime(t.lastMessageAt)}</span>
                      </div>
                      <p className="support-thread-sub">{p?.email ?? t.subject}</p>
                      <p className="support-thread-preview">
                        {t.lastMessageBody ? firstLine(t.lastMessageBody) : '尚無訊息'}
                      </p>
                    </div>
                    <div className="support-thread-meta">
                      <span className={`badge ${t.status === 'closed' ? 'closed' : 'open'}`} style={{ fontSize: '0.65rem' }}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      {t.hasUnreadFromUser ? <span className="support-unread-dot" aria-label="待回覆" /> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={`support-pane ${chatVisible ? 'support-pane--visible-mobile' : ''}`}>
          {!selectedId ? (
            <div className="support-pane-placeholder">
              <p className="muted">請在左側選擇一個對話</p>
            </div>
          ) : (
            <>
              <div className="support-pane-head">
                <button type="button" className="support-back-btn" onClick={clearSelection} aria-label="返回列表">
                  <ChevronLeft size={20} />
                </button>
                <div className="support-avatar support-avatar--sm">{avatarText(peerLabel)}</div>
                <div className="support-pane-head-text">
                  <p className="support-pane-peer">{peerLabel}</p>
                  <p className="muted" style={{ margin: 0, fontSize: '0.75rem' }}>
                    {ticket?.profiles?.email ?? ticket?.user_id}
                    {ticket?.profiles?.role ? ` · ${ticket.profiles.role}` : ''}
                  </p>
                </div>
                <div className="support-pane-status">
                  <select
                    value={ticketStatus}
                    onChange={(e) => void saveStatus(e.target.value)}
                    aria-label="對話狀態"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <option value="open">待處理</option>
                    <option value="in_progress">處理中</option>
                    <option value="closed">已結束</option>
                  </select>
                </div>
              </div>

              <div className="support-messages" dir="ltr">
                {msgLoading ? <p className="muted" style={{ fontSize: '0.8rem' }}>載入訊息…</p> : null}
                {!msgLoading && msgs.length === 0 ? (
                  <p className="support-messages-empty">租客尚未發送訊息</p>
                ) : null}
                {msgs.map((msg, index) => {
                  const isStaff = msg.is_staff;
                  const prev = index > 0 ? msgs[index - 1] : null;
                  const startUserBlock = !isStaff && (!prev || prev.is_staff);
                  if (isStaff) {
                    return (
                      <div key={msg.id} className="support-bubble-row support-bubble-row--staff">
                        <div className="support-bubble support-bubble--staff">{msg.body}</div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className="support-bubble-row support-bubble-row--user">
                      <div className="support-bubble-avatar-col">
                        {startUserBlock ? (
                          <div className="support-avatar support-avatar--xs">{avatarText(peerLabel)}</div>
                        ) : (
                          <div className="support-avatar-spacer" aria-hidden />
                        )}
                      </div>
                      <div className="support-bubble support-bubble--user">{msg.body}</div>
                    </div>
                  );
                })}
              </div>

              {chatErr ? <p className="support-chat-err">{chatErr}</p> : null}

              <div className="support-compose">
                <input
                  type="text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                  placeholder="回覆租客…"
                  disabled={sending}
                />
                <button
                  type="button"
                  className="support-send-btn"
                  disabled={sending || !body.trim()}
                  onClick={() => void sendReply()}
                  aria-label="送出"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
