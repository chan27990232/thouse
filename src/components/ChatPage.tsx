import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MoreVertical, Search, ChevronLeft, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ChatMessageContent } from './chat/ChatMessageContent';
import { ChatComposer } from './chat/ChatComposer';
import { getChatMessagePreview, type ParsedChatAttachment } from '../lib/chatMessageBody';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { supabase } from '../lib/supabase';
import {
  type ConversationWithProperty,
  type ConversationMessageRow,
  archiveConversationForUser,
  fetchConversationMessages,
  fetchConversationsForLandlord,
  fetchConversationsForTenant,
  markAllConversationsRead,
  markConversationRead,
  sendChatMessage,
} from '../lib/conversations';
import {
  isConversationArchived,
  readArchivedConversationIds,
  readChatSettings,
  writeChatSettings,
  type ChatSettings,
} from '../lib/chatInbox';
import { defaultPropertyImage } from '../lib/properties';
import { getProfileStarSummary, type StarSummary } from '../lib/transactionReviews';
import {
  THOUSE_SUPPORT_LABEL,
  THOUSE_SUPPORT_PIN_ID,
  type SupportMessageRow,
  type SupportTicketSummary,
  fetchSupportMessages,
  getOrCreateSupportTicket,
  sendSupportMessageAsUser,
} from '../lib/supportChat';
import { cn } from './ui/utils';
import { useLocale } from '../context/LocaleContext';
import { formatLocaleDateTime } from '../lib/i18nDate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

interface ChatPageProps {
  userRole: 'tenant' | 'landlord';
  onBack: () => void;
}

function firstLine(text: string) {
  return (
    getChatMessagePreview(text) ||
    text.split('\n').find((l) => l.trim())?.trim() ||
    text.slice(0, 80)
  );
}

function normalizeAuthId(id: string) {
  return id.replace(/-/g, '').trim().toLowerCase();
}

function isSameUserId(a: string, b: string | null): boolean {
  if (!b) return false;
  return normalizeAuthId(a) === normalizeAuthId(b);
}

export function ChatPage({ userRole, onBack }: ChatPageProps) {
  const { locale, chatT, commonT, localizePropertyTitle } = useLocale();
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
  const [supportTicket, setSupportTicket] = useState<SupportTicketSummary | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessageRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSettings, setChatSettings] = useState<ChatSettings>(() => readChatSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inboxActionLoading, setInboxActionLoading] = useState(false);
  const [archivedRevision, setArchivedRevision] = useState(0);

  const isSupportActive = userRole === 'tenant' && activeId === THOUSE_SUPPORT_PIN_ID;
  const activeThread = isSupportActive ? null : (threads.find((t) => t.conversation.id === activeId) ?? null);

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
      setLoadError(e instanceof Error ? e.message : chatT.loadError);
      setThreads([]);
    } finally {
      setListLoading(false);
    }
  }, [userRole, chatT.loadError]);

  const loadSupportTicket = useCallback(async (uid: string) => {
    try {
      const ticket = await getOrCreateSupportTicket(uid);
      setSupportTicket(ticket);
    } catch {
      setSupportTicket(null);
    }
  }, []);

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
      if (userRole === 'tenant') {
        await loadSupportTicket(user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadThreads, loadSupportTicket, userRole]);

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
        if (isSupportActive) {
          if (!supportTicket) {
            if (!cancelled) setMsgLoading(false);
            return;
          }
          const rows = await fetchSupportMessages(supportTicket.id);
          if (cancelled) return;
          setSupportMessages(rows);
          setSupportTicket((prev) => (prev ? { ...prev, hasUnreadFromStaff: false } : prev));
        } else {
          const rows = await fetchConversationMessages(activeId);
          if (cancelled) return;
          setMessages(rows);
          await markConversationRead(activeId);
          await loadThreads(userId);
        }
      } catch {
        if (!cancelled) {
          if (isSupportActive) setSupportMessages([]);
          else setMessages([]);
        }
      } finally {
        if (!cancelled) setMsgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, userId, loadThreads, isSupportActive, supportTicket?.id]);

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

  const totalUnread =
    threads.reduce((s, t) => s + t.unreadCount, 0) +
    (userRole === 'tenant' && supportTicket?.hasUnreadFromStaff ? 1 : 0);

  const archivedIds = useMemo(() => {
    void archivedRevision;
    return userId ? readArchivedConversationIds(userId) : new Set<string>();
  }, [userId, archivedRevision]);

  const visibleThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads.filter((item) => {
      const archived = archivedIds.has(item.conversation.id);
      if (!chatSettings.showArchived && archived) return false;
      if (!q) return true;
      const localizedTitle = localizePropertyTitle(item.propertyTitle);
      const haystack = [item.peerLabel, localizedTitle, item.propertyTitle, firstLine(item.lastMessageBody)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [threads, archivedIds, chatSettings.showArchived, searchQuery, localizePropertyTitle]);

  const activeIsArchived =
    Boolean(activeId && userId && !isSupportActive && archivedIds.has(activeId));

  const bumpArchived = () => setArchivedRevision((n) => n + 1);

  const handleMarkAllRead = async () => {
    if (!userId || inboxActionLoading) return;
    if (totalUnread === 0) {
      toast.message(chatT.markAllReadNone);
      return;
    }
    setInboxActionLoading(true);
    try {
      await markAllConversationsRead(threads.map((t) => t.conversation.id));
      if (userRole === 'tenant' && supportTicket?.hasUnreadFromStaff) {
        setSupportTicket((prev) => (prev ? { ...prev, hasUnreadFromStaff: false } : prev));
      }
      await loadThreads(userId);
      toast.success(chatT.markAllReadDone);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : chatT.actionFailed);
    } finally {
      setInboxActionLoading(false);
    }
  };

  const handleArchiveActive = async (archived: boolean) => {
    if (!userId || !activeId || isSupportActive) return;
    setInboxActionLoading(true);
    try {
      await archiveConversationForUser(activeId, userId, archived);
      bumpArchived();
      if (archived) {
        setActiveId(null);
        toast.success(chatT.archiveDone);
      } else {
        toast.success(chatT.unarchiveDone);
      }
      await loadThreads(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : chatT.actionFailed);
    } finally {
      setInboxActionLoading(false);
    }
  };

  const saveChatSettings = (next: ChatSettings) => {
    setChatSettings(next);
    writeChatSettings(next);
  };

  const getAvatarText = (name: string) => name.replace(/[（）()]/g, '').slice(0, 1) || '⋯';

  const getRoleLabel = (role: 'tenant' | 'landlord') =>
    role === 'landlord' ? chatT.landlord : chatT.tenant;

  const send = async (payload: { text: string; attachment: ParsedChatAttachment | null }) => {
    const { text, attachment } = payload;
    if (!text.trim() && !attachment) return;
    if (!activeId || !userId) return;
    const prevDraft = draft;
    setDraft('');
    try {
      if (isSupportActive && supportTicket) {
        await sendSupportMessageAsUser(supportTicket.id, userId, text, attachment);
        const rows = await fetchSupportMessages(supportTicket.id);
        setSupportMessages(rows);
        await loadSupportTicket(userId);
      } else {
        await sendChatMessage(activeId, userId, text, attachment);
        const rows = await fetchConversationMessages(activeId);
        setMessages(rows);
        await loadThreads(userId);
      }
    } catch {
      setDraft(prevDraft);
    }
  };

  if (userId === null && !listLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-gray-600">{chatT.signInRequired}</p>
        <button type="button" onClick={onBack} className="text-sm underline">
          {chatT.back}
        </button>
      </div>
    );
  }

  const chatPaneVisible = Boolean(activeId);

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-white">
      <div className="mx-auto h-[100dvh] max-w-[1600px] min-h-0 min-w-0">
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={onBack}
                    className="shrink-0 rounded-full p-2 text-gray-600 hover:bg-gray-100"
                    aria-label={chatT.back}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{chatT.inbox}</h2>
                    <p className="text-xs text-gray-500">
                      {listLoading
                        ? commonT.loading
                        : totalUnread > 0
                          ? chatT.format('unreadCount', { count: totalUnread })
                          : chatT.noUnread}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                      aria-label={chatT.more}
                      disabled={inboxActionLoading}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => void handleMarkAllRead()} disabled={inboxActionLoading}>
                      {chatT.markAllRead}
                    </DropdownMenuItem>
                    {activeId && !isSupportActive ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void handleArchiveActive(!activeIsArchived)}
                          disabled={inboxActionLoading}
                        >
                          {activeIsArchived ? chatT.unarchiveConversation : chatT.archiveConversation}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSettingsOpen(true)}>{chatT.chatSettings}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="border-0 bg-gray-50 pl-9"
                  placeholder={chatT.searchConversations}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {listLoading && threads.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">{commonT.loading}</p>
              ) : null}
              {!listLoading && userRole !== 'tenant' && threads.length === 0 ? (
                <p className="p-4 text-sm leading-relaxed text-gray-500">
                  {chatT.noConversations}
                </p>
              ) : null}
              {userRole === 'tenant' && supportTicket ? (
                <button
                  type="button"
                  onClick={() => setActiveId(THOUSE_SUPPORT_PIN_ID)}
                  className={cn(
                    'w-full border-b border-gray-100 px-3 py-3.5 text-left transition-colors',
                    isSupportActive
                      ? 'bg-gray-100 ring-1 ring-inset ring-gray-300/80'
                      : 'hover:bg-gray-50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
                      <img src={thouseLogo} alt="" className="h-8 w-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{THOUSE_SUPPORT_LABEL}</p>
                        <span className="shrink-0 text-[11px] text-gray-400">
                          {supportTicket.lastMessageAt ? formatLocaleDateTime(supportTicket.lastMessageAt, locale) : ''}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-600">{chatT.platformSupport}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {supportTicket.lastMessageBody
                          ? firstLine(supportTicket.lastMessageBody)
                          : chatT.supportHint}
                      </p>
                    </div>
                    {supportTicket.hasUnreadFromStaff ? (
                      <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] text-white">
                        1
                      </span>
                    ) : null}
                  </div>
                </button>
              ) : null}
              {visibleThreads.map((item) => {
                const isActive = item.conversation.id === activeId;
                const isArchived = archivedIds.has(item.conversation.id);
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
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {item.peerLabel}
                            {isArchived ? (
                              <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                                ({chatT.archivedBadge})
                              </span>
                            ) : null}
                          </p>
                          <span className="shrink-0 text-[11px] text-gray-400">
                            {item.lastMessageAt ? formatLocaleDateTime(item.lastMessageAt, locale) : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-600">{localizePropertyTitle(item.propertyTitle)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {item.lastMessageBody ? firstLine(item.lastMessageBody) : chatT.noMessages}
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
            {!activeThread && !isSupportActive ? (
              <div className="hidden flex-1 items-center justify-center text-sm text-gray-400 md:flex">
                {chatT.selectConversation}
              </div>
            ) : isSupportActive ? (
              <>
                <div className="shrink-0 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveId(null)}
                        className="shrink-0 rounded-full p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
                        aria-label={chatT.backToList}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
                        <img src={thouseLogo} alt="" className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{THOUSE_SUPPORT_LABEL}</p>
                        <p className="truncate text-xs text-gray-500">{chatT.supportSubtitle}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  dir="ltr"
                  className="min-h-0 w-full min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-stone-50/90 px-3 py-4 text-left md:px-6"
                >
                  {msgLoading ? <p className="text-xs text-gray-500">{chatT.loadingMessages}</p> : null}
                  {!msgLoading && supportMessages.length === 0 ? (
                    <p className="text-center text-xs text-gray-500">{chatT.supportWelcome}</p>
                  ) : null}
                  {supportMessages.map((msg, index) => {
                    const isMe = !msg.is_staff;
                    const prev = index > 0 ? supportMessages[index - 1] : null;
                    const startOtherBlock = !isMe && (!prev || prev.is_staff !== msg.is_staff);
                    if (isMe) {
                      return (
                        <div key={msg.id} className="w-full text-right" dir="ltr">
                          <div className="inline-block max-w-[85%] rounded-[1.1rem] rounded-tr-md bg-slate-200/95 px-3.5 py-2.5 text-left text-sm leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-300/25 sm:max-w-[75%]">
                            <ChatMessageContent body={msg.body} isMe />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className="flex w-full min-w-0 items-end justify-start gap-2.5">
                        <div className="flex w-8 shrink-0 flex-col items-center justify-end pb-0.5">
                          {startOtherBlock ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-stone-200">
                              <img src={thouseLogo} alt="" className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="h-8 w-8" aria-hidden />
                          )}
                        </div>
                        <div className="w-fit min-w-0 max-w-[calc(100%-2.5rem)] rounded-[1.1rem] rounded-tl-md border border-stone-200/90 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 shadow-sm">
                          <ChatMessageContent body={msg.body} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="shrink-0 border-t border-stone-200/80 bg-white p-3 md:px-5 md:pb-4">
                  {userId ? (
                    <ChatComposer
                      value={draft}
                      onChange={setDraft}
                      onSend={send}
                      placeholder={chatT.messagePlaceholder}
                      userId={userId}
                    />
                  ) : null}
                </div>
              </>
            ) : activeThread ? (
              <>
                <div className="shrink-0 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveId(null)}
                        className="shrink-0 rounded-full p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
                        aria-label={chatT.backToList}
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
                                  ? chatT.format('ratingSummary', {
                                      avg: peerStarSummary.avgStars.toFixed(1),
                                      count: peerStarSummary.reviewCount,
                                    })
                                  : chatT.noTransactionRating
                              }
                            >
                              {peerRatingLoading ? (
                                <span className="text-[11px] text-gray-400">{chatT.ratingLoading}</span>
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
                                    <span className="pl-0.5 text-[11px] text-gray-500">{chatT.noRating}</span>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100"
                          aria-label={chatT.more}
                          disabled={inboxActionLoading}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onClick={() => void handleArchiveActive(!activeIsArchived)}
                          disabled={inboxActionLoading}
                        >
                          {activeIsArchived ? chatT.unarchiveConversation : chatT.archiveConversation}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* 物業橫幅：靠上、參考 Carousell 商品條 */}
                  <div className="border-t border-gray-100 px-3 pb-3 pt-0 md:px-5">
                    <div className="flex items-stretch gap-3 rounded-xl border border-gray-200 bg-gray-50/90 p-2.5">
                      <ImageWithFallback
                        src={activeThread.propertyImage || defaultPropertyImage}
                        alt={localizePropertyTitle(activeThread.propertyTitle)}
                        className="h-20 w-[88px] shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5 py-0.5">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
                          {localizePropertyTitle(activeThread.propertyTitle)}
                        </p>
                        <p className="text-base font-bold text-gray-900">
                          ${activeThread.propertyPrice.toLocaleString()}
                          <span className="text-sm font-normal text-gray-500">{commonT.perMonth}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  dir="ltr"
                  className="min-h-0 w-full min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-stone-50/90 px-3 py-4 text-left md:px-6"
                >
                  {msgLoading ? <p className="text-xs text-gray-500">{chatT.loadingMessages}</p> : null}
                  {messages.map((msg, index) => {
                    const isMe = isSameUserId(msg.sender_id, userId);
                    const prev = index > 0 ? messages[index - 1] : null;
                    const startOtherBlock =
                      !isMe && (!prev || (userId && isSameUserId(prev.sender_id, userId)));
                    if (isMe) {
                      return (
                        <div key={msg.id} className="w-full text-right" dir="ltr">
                          <div className="inline-block max-w-[85%] rounded-[1.1rem] rounded-tr-md bg-slate-200/95 px-3.5 py-2.5 text-left text-sm leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-300/25 sm:max-w-[75%]">
                            <ChatMessageContent body={msg.body} isMe />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className="w-full min-w-0">
                        {startOtherBlock ? (
                          <p className="mb-1 pl-10 text-[11px] font-medium text-gray-500">{activeThread.peerLabel}</p>
                        ) : null}
                        <div className="flex w-full min-w-0 items-end justify-start gap-2.5">
                        <div className="flex w-8 shrink-0 flex-col items-center justify-end pb-0.5">
                          {startOtherBlock ? (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-gradient-to-b from-stone-100 to-stone-200 text-xs font-semibold text-stone-700 shadow-sm">
                              {getAvatarText(activeThread.peerLabel)}
                            </div>
                          ) : (
                            <div className="h-8 w-8" aria-hidden />
                          )}
                        </div>
                        <div className="w-fit min-w-0 max-w-[calc(100%-2.5rem)] rounded-[1.1rem] rounded-tl-md border border-stone-200/90 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 shadow-sm">
                          <ChatMessageContent body={msg.body} />
                        </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="shrink-0 border-t border-stone-200/80 bg-white p-3 md:px-5 md:pb-4">
                  {userId ? (
                    <ChatComposer
                      value={draft}
                      onChange={setDraft}
                      onSend={send}
                      placeholder={chatT.messagePlaceholder}
                      userId={userId}
                    />
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{chatT.chatSettingsTitle}</DialogTitle>
            <DialogDescription>{chatT.showArchivedHint}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id="chat-show-archived"
              checked={chatSettings.showArchived}
              onCheckedChange={(v) => saveChatSettings({ ...chatSettings, showArchived: v === true })}
            />
            <Label htmlFor="chat-show-archived" className="cursor-pointer text-sm leading-relaxed">
              {chatT.showArchived}
            </Label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
