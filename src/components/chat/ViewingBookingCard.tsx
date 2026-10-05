import { useState } from 'react';
import { Calendar, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useLocale } from '../../context/LocaleContext';
import { formatLocaleDateTime } from '../../lib/i18nDate';
import {
  respondToViewingBooking,
  type ViewingBooking,
  type ViewingBookingStatus,
  type ParsedViewingPayload,
} from '../../lib/viewingBookings';

type ViewingBookingCardProps = {
  payload: ParsedViewingPayload;
  booking?: ViewingBooking;
  userRole: 'tenant' | 'landlord';
  propertyAddress?: string;
  onStatusChange?: (bookingId: string, status: ViewingBookingStatus) => void;
  onAcceptConfirm?: (bookingId: string) => Promise<void>;
  onIgnoreConfirm?: (bookingId: string) => Promise<void>;
};

export function ViewingBookingCard({
  payload,
  booking,
  userRole,
  propertyAddress,
  onStatusChange,
  onAcceptConfirm,
  onIgnoreConfirm,
}: ViewingBookingCardProps) {
  const { locale, chatT } = useLocale();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [responding, setResponding] = useState(false);
  const status = booking?.status ?? 'pending';
  const startAt = booking?.startsAt ?? payload.startAt;
  const endAt = booking?.endsAt ?? payload.endAt;

  if (userRole === 'tenant' && status === 'ignored') {
    return null;
  }

  const statusLabel =
    status === 'accepted' ? chatT.viewingAccepted : status === 'ignored' ? chatT.viewingIgnored : chatT.viewingPending;

  const handleRespond = async (decision: 'accepted' | 'ignored') => {
    setResponding(true);
    try {
      if (decision === 'accepted' && onAcceptConfirm) {
        await onAcceptConfirm(payload.bookingId);
      } else if (decision === 'ignored' && onIgnoreConfirm) {
        await onIgnoreConfirm(payload.bookingId);
      } else {
        await respondToViewingBooking(payload.bookingId, decision);
        onStatusChange?.(payload.bookingId, decision);
      }
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : chatT.viewingRespondFailed);
    } finally {
      setResponding(false);
    }
  };

  return (
    <>
      <div className="min-w-[16rem] space-y-2 rounded-xl border border-stone-200 bg-white p-3 text-left shadow-sm">
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-stone-600" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">{chatT.viewingCardTitle}</p>
            <p className="mt-1 text-sm text-stone-700">
              {formatLocaleDateTime(startAt, locale)}
              {' – '}
              {formatLocaleDateTime(endAt, locale)}
            </p>
            {!(userRole === 'tenant' && status === 'ignored') ? (
              <p className="mt-1 text-xs text-stone-500">{statusLabel}</p>
            ) : null}
          </div>
        </div>
        {userRole === 'landlord' && status === 'pending' ? (
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              className="h-8 flex-1 bg-black text-white hover:bg-gray-800"
              disabled={responding}
              onClick={() => setConfirmOpen(true)}
            >
              {chatT.viewingAccept}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex-1"
              disabled={responding}
              onClick={() => void handleRespond('ignored')}
            >
              {chatT.viewingIgnore}
            </Button>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !responding && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{chatT.viewingAcceptConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>{chatT.viewingAcceptConfirmDesc}</p>
                {propertyAddress?.trim() ? (
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-left text-stone-800">
                    <p className="text-xs font-medium text-stone-500">{chatT.viewingAddressLabel}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{propertyAddress.trim()}</p>
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={responding}>{chatT.viewingAcceptConfirmCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={responding}
              className="bg-black text-white hover:bg-gray-800"
              onClick={(e) => {
                e.preventDefault();
                void handleRespond('accepted');
              }}
            >
              {chatT.viewingAcceptConfirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type ViewingSuccessCardProps = {
  payload: ParsedViewingPayload;
};

export function ViewingSuccessCard({ payload }: ViewingSuccessCardProps) {
  const { locale, chatT } = useLocale();
  return (
    <div className="min-w-[16rem] overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/80 text-left shadow-sm">
      <div className="flex items-center gap-2 border-b border-emerald-100 bg-white/70 px-3 py-2">
        <FileText className="h-4 w-4 shrink-0 text-emerald-700" strokeWidth={1.75} />
        <span className="text-xs font-medium text-emerald-800">{chatT.viewingSuccessAttachment}</span>
      </div>
      <div className="flex items-start gap-2 px-3 py-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-950">{chatT.viewingSuccess}</p>
          <p className="mt-1 text-sm text-emerald-900/90">
            {formatLocaleDateTime(payload.startAt, locale)}
            {' – '}
            {formatLocaleDateTime(payload.endAt, locale)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ViewingIgnoredCard({ payload }: ViewingSuccessCardProps) {
  const { locale, chatT } = useLocale();
  return (
    <div className="min-w-[16rem] overflow-hidden rounded-xl border border-stone-200 bg-stone-50 text-left shadow-sm">
      <div className="flex items-center gap-2 border-b border-stone-100 bg-white/70 px-3 py-2">
        <FileText className="h-4 w-4 shrink-0 text-stone-600" strokeWidth={1.75} />
        <span className="text-xs font-medium text-stone-700">{chatT.viewingIgnoredAttachment}</span>
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-semibold text-stone-900">{chatT.viewingIgnored}</p>
        <p className="mt-1 text-sm text-stone-700">
          {formatLocaleDateTime(payload.startAt, locale)}
          {' – '}
          {formatLocaleDateTime(payload.endAt, locale)}
        </p>
        <p className="mt-2 text-xs text-stone-500">{chatT.viewingIgnoredNotice}</p>
      </div>
    </div>
  );
}
