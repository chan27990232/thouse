import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, Heart, MoreVertical, Search, Send, ChevronLeft, Star } from 'lucide-react';
import { Input } from './ui/input';
import { ImageWithFallback } from './figma/ImageWithFallback';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { supabase } from '../lib/supabase';
import {
  type ConversationWithProperty,
  type ConversationMessageRow,
  fetchConversationMessages,
  fetchConversationsForLandlord,
  fetchConversationsForTenant,
  markConversationRead,
  sendChatMessage,
} from '../lib/conversations';
import { defaultPropertyImage } from '../lib/properties';
import { getProfileStarSummary, type StarSummary } from '../lib/transactionReviews';
import { cn } from './ui/utils';

interface ChatPageProps {
  userRole: 'tenant' | 'landlord';
  onBack: () => void;
}

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

function normalizeAuthId(id: string) {
  return id.replace(/-/g, '').trim().toLowerCase();
}

function isSameUserId(a: string, b: string | null): boolean {
  if (!b) return false;
  return normalizeAuthId(a) === normalizeAuthId(b);
}

export function ChatPage({ userRole, onBack }: ChatPageProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [threads, setThreads] = useState<ConversationWithProperty[]>([]);
  const [loadError, setLoadError] = useState('');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessageRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [peerStarSummary, setPeerStarSummary] = useState<StarSummary>({ avgStars: 0, reviewCount: 0 });
  const [peerRatingLoading, setPeerRatingLoading] = useState(false);

  const activeThread = threads.find((t) => t.conversation.id === activeId) ?? null;

  const activeTenantIdForLandlord = useMemo(() => {
    if (userRole !== 'landlord' || !activeId) return null;
    return threads.find((t) => t.conversation.id === activeId)?.conversation.tenant_id ?? null;
  }, [userRole, activeId, threads]);

  const loadThreads = useCallback(async (uid: string) => {
    setListLoading(true);
    setLoadError('');
    try {
      const data =
        userRole === 'landlord'
          ? await fetchConversationsForLandlord(uid)
          : await fetchConversationsForTenant(uid);
      setThreads(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '無法載入對話');
      setThreads([]);
    } finally {
      setListLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setUserId(null);
        setListLoading(false);
        return;
      }
      setUserId(user.id);
      await loadThreads(user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadThreads]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeId || !userId) return;
    let cancelled = false;
    (async () => {
      setMsgLoading(true);
      try {
        const rows = await fetchConversationMessages(activeId);
        if (cancelled) return;
        setMessages(rows);
        await markConversationRead(activeId);
        await loadThreads(userId);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setMsgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, userId, loadThreads]);

  useEffect(() => {
    if (!activeTenantIdForLandlord) {
      setPeerStarSummary({ avgStars: 0, reviewCount: 0 });
      setPeerRatingLoading(false);
      return;
    }
    let cancelled = false;
    setPeerRatingLoading(true);
    (async () => {
      try {
        const s = await getProfileStarSummary(activeTenantIdForLandlord);
        if (!cancelled) setPeerStarSummary(s);
      } catch {
        if (!cancelled) setPeerStarSummary({ avgStars: 0, reviewCount: 0 });
      } finally {
        if (!cancelled) setPeerRatingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTenantIdForLandlord]);

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);

  const getAvatarText = (name: string) => name.replace(/[（）()]/g, '').slice(0, 1) || '⋯';

  const getRoleLabel = (role: 'tenant' | 'landlord') => (role === 'landlord' ? '業主' : '租客');

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId || !userId) return;
    setDraft('');
    try {
      await sendChatMessage(activeId, userId, text);
      const rows = await fetchConversationMessages(activeId);
      setMessages(rows);
      await loadThreads(userId);
    } catch {
      setDraft(text);
    }
  };

  if (userId === null && !listLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-gray-600">請先登入以使用聊天室</p>
        <button type="button" onClick={onBack} className="text-sm underline">
          返回
        </button>
      </div>
    );
  }

  const chatPaneVisible = Boolean(activeId);

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-white">
      <div className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex min-h-14 max-w-[1600px] flex-wrap items-center justify-between gap-x-2 gap-y-2 px-3 py-2 sm:px-4 sm:py-0 md:h-14 md:px-6 md:py-0">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button type="button" onClick={onBack} className="shrink-0 rounded-full p-2 hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <img src={thouseLogo} alt="簡屋" className="h-8 w-8 shrink-0" />
              <span className="hidden font-semibold tracking-wide sm:inline">Thouse</span>
            </div>
            <div className="hidden items-center gap-5 text-sm text-gray-600 lg:flex">
              <span>首頁</span>
              <span>租盤</span>
              <span>聊天</span>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-gray-500 sm:gap-3">
            <Heart className="hidden h-5 w-5 sm:block" />
            <Bell className="hidden h-5 w-5 sm:block" />
            <div className="h-8 w-8 rounded-full bg-gray-100" />
          </div>
        </div>
      </div>

      <div className="mx-auto h-[calc(100vh-3.5rem)] max-w-[1600px] min-h-0 min-w-0">
        {loadError ? <p className="p-4 text-sm text-red-600">{loadError}</p> : null}

        <div className="flex h-full min-h-0">
          {/* 左欄：對話列表（手機有選中對話時隱藏） */}
          <aside
            className={cn(
              'flex w-full min-h-0 flex-col border-r border-gray-200 bg-white md:max-w-[400px] md:w-[min(100%,400px)] md:shrink-0',
              activeId ? 'hidden md:flex' : 'flex',
            )}
          >
            <div className="shrink-0 border-b border-gray-100 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">收件匣</h2>
                  <p className="text-xs text-gray-500">
                    {listLoading ? '載入中…' : totalUnread > 0 ? `${totalUnread} 未讀` : '沒有未讀訊息'}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="更多"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input className="border-0 bg-gray-50 pl-9" placeholder="搜尋對話" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {listLoading && threads.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">載入中…</p>
              ) : null}
              {!listLoading && threads.length === 0 ? (
                <p className="p-4 text-sm leading-relaxed text-gray-500">
                  暫沒有對話；可從租盤內使用「聯絡業主」發出第一則查詢。
                </p>
              ) : null}
              {threads.map((item) => {
                const isActive = item.conversation.id === activeId;
                return (
                  <button
                    type="button"
                    key={item.conversation.id}
                    onClick={() => setActiveId(item.conversation.id)}
                    className={cn(
                      'w-full border-b border-gray-100 px-3 py-3.5 text-left transition-colors',
                      isActive
                        ? 'bg-gray-100 ring-1 ring-inset ring-gray-300/80'
                        : 'hover:bg-gray-50',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-sm font-medium text-white">
                        {getAvatarText(item.peerLabel)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900">{item.peerLabel}</p>
                          <span className="shrink-0 text-[11px] text-gray-400">
                            {item.lastMessageAt ? formatListTime(item.lastMessageAt) : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-600">{item.propertyTitle}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {item.lastMessageBody ? firstLine(item.lastMessageBody) : '暫沒有訊息'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {item.propertyImage ? (
                          <ImageWithFallback
                            src={item.propertyImage}
                            alt=""
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : null}
                        {item.unreadCount > 0 ? (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] text-white">
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* 右欄：對話內容（手機需先選列表；大螢幕無選中時顯示佔位） */}
          <section
            className={cn(
              'min-h-0 min-w-0 flex-1 flex-col bg-[#f5f5f5]',
              chatPaneVisible ? 'flex' : 'hidden md:flex',
            )}
          >
            {!activeThread ? (
              <div className="hidden flex-1 items-center justify-center text-sm text-gray-400 md:flex">
                請在左側選擇一個對話
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveId(null)}
                        className="shrink-0 rounded-full p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
                        aria-label="返回列表"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-medium text-white">
                        {getAvatarText(activeThread.peerLabel)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="min-w-0 max-w-full truncate text-sm font-semibold">
                            {activeThread.peerLabel}
                          </p>
                          {userRole === 'landlord' ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5"
                              title={
                                peerStarSummary.reviewCount > 0
                                  ? `平均 ${peerStarSummary.avgStars.toFixed(1)} 星 · ${peerStarSummary.reviewCount} 則評價`
                                  : '未有交易評分'
                              }
                            >
                              {peerRatingLoading ? (
                                <span className="text-[11px] text-gray-400">評分載入中…</span>
                              ) : (
                                <>
                                  {[1, 2, 3, 4, 5].map((n) => {
                                    const has = peerStarSummary.reviewCount > 0;
                                    const filled = has && n <= Math.round(peerStarSummary.avgStars);
                                    return (
                                      <Star
                                        key={n}
                                        className={`h-3.5 w-3.5 ${filled ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`}
                                        aria-hidden
                                      />
                                    );
                                  })}
                                  {peerStarSummary.reviewCount === 0 ? (
                                    <span className="pl-0.5 text-[11px] text-gray-500">(未有評分)</span>
                                  ) : (
                                    <span className="pl-0.5 text-[11px] text-gray-600 tabular-nums">
                                      {peerStarSummary.avgStars.toFixed(1)}
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {getRoleLabel(userRole === 'landlord' ? 'tenant' : 'landlord')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100"
                      aria-label="更多"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 物業橫幅：靠上、參考 Carousell 商品條 */}
                  <div className="border-t border-gray-100 px-3 pb-3 pt-0 md:px-5">
                    <div className="flex items-stretch gap-3 rounded-xl border border-gray-200 bg-gray-50/90 p-2.5">
                      <ImageWithFallback
                        src={activeThread.propertyImage || defaultPropertyImage}
                        alt={activeThread.propertyTitle}
                        className="h-20 w-[88px] shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5 py-0.5">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
                          {activeThread.propertyTitle}
                        </p>
                        <p className="text-base font-bold text-gray-900">
                          ${activeThread.propertyPrice.toLocaleString()}
                          <span className="text-sm font-normal text-gray-500">/月</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  dir="ltr"
                  className="min-h-0 w-full min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-stone-50/90 px-3 py-4 text-left md:px-6"
                >
                  {msgLoading ? <p className="text-xs text-gray-500">載入訊息…</p> : null}
                  {messages.map((msg, index) => {
                    const isMe = isSameUserId(msg.sender_id, userId);
                    const prev = index > 0 ? messages[index - 1] : null;
                    const startOtherBlock =
                      !isMe && (!prev || (userId && isSameUserId(prev.sender_id, userId)));
                    if (isMe) {
                      return (
                        <div key={msg.id} className="w-full text-right" dir="ltr">
                          <div
                            className="inline-block max-w-[85%] rounded-[1.1rem] rounded-tr-md bg-slate-200/95 px-3.5 py-2.5 text-left text-sm leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-300/25 break-words whitespace-pre-wrap sm:max-w-[75%]"
                          >
                            {msg.body}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className="flex w-full min-w-0 items-end justify-start gap-2.5">
                        <div className="flex w-8 shrink-0 flex-col items-center justify-end pb-0.5">
                          {startOtherBlock ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-gradient-to-b from-stone-100 to-stone-200 text-xs font-semibold text-stone-700 shadow-sm">
                              {getAvatarText(activeThread.peerLabel)}
                            </div>
                          ) : (
                            <div className="h-8 w-8" aria-hidden />
                          )}
                        </div>
                        <div
                          className="w-fit min-w-0 max-w-[calc(100%-2.5rem)] rounded-[1.1rem] rounded-tl-md border border-stone-200/90 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 shadow-sm break-words whitespace-pre-wrap"
                        >
                          {msg.body}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="shrink-0 border-t border-stone-200/80 bg-white p-3 md:px-5 md:pb-4">
                  <div className="flex items-center gap-3">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void send();
                      }}
                      placeholder="在此輸入訊息…"
                      className="min-h-10 flex-1 rounded-full border-stone-200 bg-white py-2.5 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void send()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-gray-800"
                      aria-label="送出"
                    >
                      <Send className="h-4 w-4 shrink-0" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
