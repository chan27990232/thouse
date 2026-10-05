import { supabase } from './supabase';

export type ViewingBookingStatus = 'pending' | 'accepted' | 'ignored';

export type ViewingBooking = {
  id: string;
  conversationId: string;
  propertyId: string;
  landlordId: string;
  tenantId: string;
  startsAt: string;
  endsAt: string;
  status: ViewingBookingStatus;
};

export type ParsedViewingPayload = {
  bookingId: string;
  startAt: string;
  endAt: string;
};

const SCHEMA_HINT = '請在 Supabase SQL Editor 執行 supabase/viewing_bookings.sql 後再試。';
const VIEWING_RE = /^\[thouse-viewing\]([\s\S]*?)\[\/thouse-viewing\]\n?/;
const VIEWING_SUCCESS_RE = /^\[thouse-viewing-success\]([\s\S]*?)\[\/thouse-viewing-success\]\n?/;
const VIEWING_IGNORED_RE = /^\[thouse-viewing-ignored\]([\s\S]*?)\[\/thouse-viewing-ignored\]\n?/;

export const VIEWING_WINDOW_START_HOUR = 9;
export const VIEWING_WINDOW_END_HOUR = 18;
export const VIEWING_START_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

export function hongKongYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function hongKongHourMinute(now = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

export function localDateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function viewingInstantFromHk(ymd: string, hour: number): Date {
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00+08:00`);
}

export function isHkDateInPast(ymd: string, now = new Date()): boolean {
  return ymd < hongKongYmd(now);
}

export function isHkStartInPast(ymd: string, startHour: number, now = new Date()): boolean {
  return viewingInstantFromHk(ymd, startHour).getTime() <= now.getTime();
}

export function allowedEndHours(startHour: number): number[] {
  const ends: number[] = [];
  if (startHour + 1 <= VIEWING_WINDOW_END_HOUR) ends.push(startHour + 1);
  if (startHour + 2 <= VIEWING_WINDOW_END_HOUR) ends.push(startHour + 2);
  return ends;
}

export function defaultEndHour(startHour: number): number {
  const ends = allowedEndHours(startHour);
  return ends.includes(startHour + 2) ? startHour + 2 : (ends[0] ?? startHour + 1);
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function schemaError(error: { message?: string } | null): Error | null {
  const raw = (error?.message || '').toLowerCase();
  if (
    raw.includes('viewing_bookings') &&
    (raw.includes('schema cache') || raw.includes('does not exist') || raw.includes('could not find'))
  ) {
    return new Error(`資料庫尚未建立「睇樓預約」資料表。${SCHEMA_HINT}`);
  }
  return null;
}

export function parseViewingPayload(body: string): { viewing: ParsedViewingPayload | null; rest: string } {
  const match = body.match(VIEWING_RE);
  if (!match) return { viewing: null, rest: body };
  try {
    const parsed = JSON.parse(match[1]!) as ParsedViewingPayload;
    if (parsed?.bookingId && parsed?.startAt && parsed?.endAt) {
      return { viewing: parsed, rest: body.slice(match[0].length) };
    }
  } catch {
    /* ignore */
  }
  return { viewing: null, rest: body };
}

export function buildViewingMessageBody(payload: ParsedViewingPayload, text: string): string {
  const block = `[thouse-viewing]${JSON.stringify(payload)}[/thouse-viewing]`;
  const trimmed = text.trim();
  return trimmed ? `${block}\n${trimmed}` : block;
}

export function parseViewingSuccessPayload(body: string): {
  success: ParsedViewingPayload | null;
  rest: string;
} {
  const match = body.match(VIEWING_SUCCESS_RE);
  if (!match) return { success: null, rest: body };
  try {
    const parsed = JSON.parse(match[1]!) as ParsedViewingPayload;
    if (parsed?.bookingId && parsed?.startAt && parsed?.endAt) {
      return { success: parsed, rest: body.slice(match[0].length) };
    }
  } catch {
    /* ignore */
  }
  return { success: null, rest: body };
}

export function buildViewingSuccessMessageBody(payload: ParsedViewingPayload, text: string): string {
  const block = `[thouse-viewing-success]${JSON.stringify(payload)}[/thouse-viewing-success]`;
  const trimmed = text.trim();
  return trimmed ? `${block}\n${trimmed}` : block;
}

export function parseViewingIgnoredPayload(body: string): {
  ignored: ParsedViewingPayload | null;
  rest: string;
} {
  const match = body.match(VIEWING_IGNORED_RE);
  if (!match) return { ignored: null, rest: body };
  try {
    const parsed = JSON.parse(match[1]!) as ParsedViewingPayload;
    if (parsed?.bookingId && parsed?.startAt && parsed?.endAt) {
      return { ignored: parsed, rest: body.slice(match[0].length) };
    }
  } catch {
    /* ignore */
  }
  return { ignored: null, rest: body };
}

export function buildViewingIgnoredMessageBody(payload: ParsedViewingPayload, text: string): string {
  const block = `[thouse-viewing-ignored]${JSON.stringify(payload)}[/thouse-viewing-ignored]`;
  const trimmed = text.trim();
  return trimmed ? `${block}\n${trimmed}` : block;
}

export function viewingSlotRange(ymd: string, startHour: number, endHour: number): { start: Date; end: Date } {
  return {
    start: viewingInstantFromHk(ymd, startHour),
    end: viewingInstantFromHk(ymd, endHour),
  };
}

function mapRow(row: {
  id: string;
  conversation_id: string;
  property_id: string;
  landlord_id: string;
  tenant_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}): ViewingBooking {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    propertyId: row.property_id,
    landlordId: row.landlord_id,
    tenantId: row.tenant_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: (row.status as ViewingBookingStatus) || 'pending',
  };
}

export async function fetchViewingBookingsForConversation(conversationId: string): Promise<ViewingBooking[]> {
  const { data, error } = await supabase
    .from('viewing_bookings')
    .select('id, conversation_id, property_id, landlord_id, tenant_id, starts_at, ends_at, status')
    .eq('conversation_id', conversationId)
    .order('starts_at', { ascending: true });

  if (error) {
    const mapped = schemaError(error);
    if (mapped) return [];
    throw new Error(error.message || '無法載入睇樓預約');
  }
  return (data ?? []).map(mapRow);
}

export async function createViewingBooking(input: {
  conversationId: string;
  propertyId: string;
  landlordId: string;
  tenantId: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<ViewingBooking> {
  const durationMs = input.endsAt.getTime() - input.startsAt.getTime();
  if (durationMs !== 60 * 60 * 1000 && durationMs !== 2 * 60 * 60 * 1000) {
    throw new Error('睇樓時段只可為 1 或 2 小時');
  }
  if (input.startsAt.getTime() <= Date.now()) {
    throw new Error('只可預約香港時間未來的時段');
  }
  const { data, error } = await supabase
    .from('viewing_bookings')
    .insert({
      conversation_id: input.conversationId,
      property_id: input.propertyId,
      landlord_id: input.landlordId,
      tenant_id: input.tenantId,
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
      status: 'pending',
    })
    .select('id, conversation_id, property_id, landlord_id, tenant_id, starts_at, ends_at, status')
    .single();

  if (error || !data) {
    const mapped = schemaError(error);
    if (mapped) throw mapped;
    throw new Error(error?.message || '無法送出睇樓預約');
  }
  return mapRow(data);
}

export async function respondToViewingBooking(
  bookingId: string,
  decision: 'accepted' | 'ignored',
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_viewing_booking', {
    p_booking_id: bookingId,
    p_decision: decision,
  });
  if (error) {
    const mapped = schemaError(error);
    if (mapped) throw mapped;
    const raw = (error.message || '').toLowerCase();
    if (raw.includes('viewing_not_found')) {
      throw new Error('此預約已處理或不存在。');
    }
    throw new Error(error.message || '無法更新預約');
  }
}
