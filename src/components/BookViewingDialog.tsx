import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { useLocale } from '../context/LocaleContext';
import { formatLocaleDateTime } from '../lib/i18nDate';
import {
  VIEWING_START_HOURS,
  allowedEndHours,
  createViewingBooking,
  defaultEndHour,
  fetchViewingBookingsForConversation,
  intervalsOverlap,
  isHkDateInPast,
  isHkStartInPast,
  localDateToYmd,
  viewingSlotRange,
  type ViewingBooking,
} from '../lib/viewingBookings';
import { cn } from './ui/utils';

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

type BookViewingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  propertyId: string;
  landlordId: string;
  tenantId: string;
  propertyTitle: string;
  onBooked: (booking: ViewingBooking) => Promise<void>;
};

export function BookViewingDialog({
  open,
  onOpenChange,
  conversationId,
  propertyId,
  landlordId,
  tenantId,
  propertyTitle,
  onBooked,
}: BookViewingDialogProps) {
  const { locale, chatT } = useLocale();
  const [date, setDate] = useState<Date | undefined>();
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [existing, setExisting] = useState<ViewingBooking[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(undefined);
    setStartHour(null);
    setEndHour(null);
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchViewingBookingsForConversation(conversationId);
        if (!cancelled) setExisting(rows);
      } catch {
        if (!cancelled) setExisting([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  const selectedYmd = date ? localDateToYmd(date) : '';

  const slotOverlaps = (start: Date, end: Date) =>
    existing.some((booking) => {
      if (booking.status === 'ignored') return false;
      return intervalsOverlap(start, end, new Date(booking.startsAt), new Date(booking.endsAt));
    });

  const startHours = useMemo(() => {
    if (!selectedYmd) return [] as number[];
    return VIEWING_START_HOURS.filter((hour) => {
      if (isHkStartInPast(selectedYmd, hour)) return false;
      return allowedEndHours(hour).some((end) => {
        const { start, end: finish } = viewingSlotRange(selectedYmd, hour, end);
        return !slotOverlaps(start, finish);
      });
    });
  }, [selectedYmd, existing]);

  const endHours = useMemo(() => {
    if (!selectedYmd || startHour == null) return [] as number[];
    return allowedEndHours(startHour).filter((end) => {
      const { start, end: finish } = viewingSlotRange(selectedYmd, startHour, end);
      return !slotOverlaps(start, finish);
    });
  }, [selectedYmd, startHour, existing]);

  useEffect(() => {
    if (!selectedYmd) return;
    if (startHours.length === 0) {
      setStartHour(null);
      setEndHour(null);
      return;
    }
    setStartHour((prev) => (prev != null && startHours.includes(prev) ? prev : startHours[0]!));
  }, [selectedYmd, startHours]);

  useEffect(() => {
    if (startHour == null || !selectedYmd) return;
    const ends = allowedEndHours(startHour).filter((end) => {
      const { start, end: finish } = viewingSlotRange(selectedYmd, startHour, end);
      return !slotOverlaps(start, finish);
    });
    setEndHour((prev) => {
      if (prev != null && ends.includes(prev)) return prev;
      if (ends.includes(startHour + 2)) return startHour + 2;
      return ends[0] ?? null;
    });
  }, [startHour, selectedYmd, existing]);

  const handleStartChange = (hour: number) => {
    setStartHour(hour);
    setEndHour(defaultEndHour(hour));
  };

  const handleSubmit = async () => {
    if (!selectedYmd || startHour == null || endHour == null || submitting) return;
    const { start, end } = viewingSlotRange(selectedYmd, startHour, endHour);
    if (start.getTime() <= Date.now()) {
      toast.error(chatT.bookViewingFutureOnly);
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createViewingBooking({
        conversationId,
        propertyId,
        landlordId,
        tenantId,
        startsAt: start,
        endsAt: end,
      });
      await onBooked(booking);
      toast.success(chatT.bookViewingSent);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : chatT.sendFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <CalendarDays className="h-5 w-5 shrink-0" />
            {chatT.bookViewingTitle}
          </DialogTitle>
          <DialogDescription>
            {propertyTitle}
            <br />
            {chatT.bookViewingHint}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <p className="mb-2 text-sm font-medium">{chatT.bookViewingPickDate}</p>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(next) => {
                setDate(next);
                setStartHour(null);
                setEndHour(null);
              }}
              disabled={(day) => isHkDateInPast(localDateToYmd(day))}
              className="rounded-xl border border-stone-200"
            />
          </div>

          {date ? (
            <div>
              <p className="mb-2 text-sm font-medium">{chatT.bookViewingPickSlot}</p>
              {startHours.length === 0 || startHour == null || endHour == null ? (
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-4 text-center text-sm text-stone-600">
                  {chatT.bookViewingNoSlots}
                </p>
              ) : (
                <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-3">
                  <div>
                    <p className="mb-2 text-xs font-medium text-stone-500">{chatT.bookViewingStart}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {startHours.map((hour) => (
                        <button
                          key={`start-${hour}`}
                          type="button"
                          onClick={() => handleStartChange(hour)}
                          className={cn(
                            'rounded-xl border px-2 py-2.5 text-sm tabular-nums transition',
                            startHour === hour
                              ? 'border-black bg-black text-white'
                              : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50',
                          )}
                        >
                          {formatHourLabel(hour)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-stone-500">{chatT.bookViewingEnd}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(endHours.length > 0 ? endHours : [endHour]).map((hour) => (
                        <button
                          key={`end-${hour}`}
                          type="button"
                          onClick={() => setEndHour(hour)}
                          className={cn(
                            'rounded-xl border px-2 py-2.5 text-sm tabular-nums transition',
                            endHour === hour
                              ? 'border-black bg-black text-white'
                              : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50',
                          )}
                        >
                          {formatHourLabel(hour)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {date && startHour != null && endHour != null && startHours.length > 0 ? (
            <p className="text-sm text-stone-600">
              {formatLocaleDateTime(viewingSlotRange(selectedYmd, startHour, endHour).start.toISOString(), locale)}
              {' – '}
              {formatLocaleDateTime(viewingSlotRange(selectedYmd, startHour, endHour).end.toISOString(), locale)}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full bg-black text-white hover:bg-gray-800"
            disabled={!date || startHour == null || endHour == null || startHours.length === 0 || submitting}
            onClick={() => void handleSubmit()}
          >
            {chatT.bookViewingSubmit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
