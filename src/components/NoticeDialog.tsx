import { useEffect, useState } from 'react';
import { Bell, Loader2, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { fetchUnreadNoticesForLandlord, fetchUnreadNoticesForTenant, type UnreadNoticeItem } from '../lib/conversations';
import { NoticeMessageBody } from './NoticeMessageBody';
import { useLocale } from '../context/LocaleContext';
import { formatLocaleDateTime } from '../lib/i18nDate';
import { translateRoleFallback } from '../content/translations/chat';

interface NoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: 'tenant' | 'landlord';
  onOpenChat?: () => void;
}

function NoticeCard({
  notice,
  onOpenChat,
  onClose,
}: {
  notice: UnreadNoticeItem;
  onOpenChat?: () => void;
  onClose: () => void;
}) {
  const { locale, noticeT, localizePropertyTitle } = useLocale();
  const fromName = translateRoleFallback(notice.fromLabel, locale);
  const displayPropertyTitle = localizePropertyTitle(notice.propertyTitle);

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{displayPropertyTitle}</p>
          <p className="mt-0.5 text-xs text-gray-600">{noticeT.format('fromLabel', { name: fromName })}</p>
        </div>
        <time className="shrink-0 text-xs text-gray-500" dateTime={notice.createdAt}>
          {formatLocaleDateTime(notice.createdAt, locale)}
        </time>
      </div>

      <NoticeMessageBody body={notice.body} />

      {onOpenChat ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-8 w-full text-xs"
          onClick={() => {
            onClose();
            onOpenChat();
          }}
        >
          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
          {noticeT.goToChat}
        </Button>
      ) : null}
    </article>
  );
}

export function NoticeDialog({ open, onOpenChange, userRole, onOpenChat }: NoticeDialogProps) {
  const { homeT, landlordT, noticeT, commonT } = useLocale();
  const titleLabel = userRole === 'landlord' ? landlordT.notice : homeT.notice;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UnreadNoticeItem[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) {
          setItems([]);
          return;
        }
        const next =
          userRole === 'landlord'
            ? await fetchUnreadNoticesForLandlord(user.id)
            : await fetchUnreadNoticesForTenant(user.id);
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userRole]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {titleLabel}
            {!loading && items.length > 0 ? (
              <span className="text-xs font-normal text-gray-500">
                {noticeT.format('unreadCount', { count: items.length })}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {commonT.loading}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{noticeT.noNotices}</p>
          ) : (
            items.map((n) => (
              <NoticeCard
                key={n.messageId}
                notice={n}
                onOpenChat={onOpenChat}
                onClose={() => onOpenChange(false)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
