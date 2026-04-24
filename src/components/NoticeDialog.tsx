import { useEffect, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { supabase } from '../lib/supabase';
import { fetchUnreadNoticesForLandlord, fetchUnreadNoticesForTenant, type UnreadNoticeItem } from '../lib/conversations';

interface NoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: 'tenant' | 'landlord';
}

function formatTime(iso: string) {
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

export function NoticeDialog({ open, onOpenChange, userRole }: NoticeDialogProps) {
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
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            通知
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              載入中…
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">暫無新通知</p>
          ) : (
            items.map((n) => (
              <div key={n.messageId} className="rounded-lg border p-3 text-sm leading-relaxed bg-gray-50 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-800">{n.propertyTitle}</span>
                  <span>{formatTime(n.createdAt)}</span>
                </div>
                <div className="text-xs text-gray-600">來自 {n.fromLabel}</div>
                <p className="text-gray-800 whitespace-pre-wrap">{n.bodyPreview}</p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
