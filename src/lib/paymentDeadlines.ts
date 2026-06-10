import { supabase } from './supabase';
import { appTodayIso, parseDateOnly } from './appClock';

let holidayCache: Set<string> | null = null;

async function loadHolidaySet(): Promise<Set<string>> {
  if (holidayCache) return holidayCache;
  const { data } = await supabase
    .from('calendar_days')
    .select('calendar_date')
    .eq('is_public_holiday', true)
    .limit(5000);
  holidayCache = new Set((data ?? []).map((r) => String((r as { calendar_date: string }).calendar_date)));
  return holidayCache;
}

export function isWeekendDate(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export function isNonWorkingDaySync(d: Date, holidays: Set<string>): boolean {
  const iso = formatDateIso(d);
  return isWeekendDate(d) || holidays.has(iso);
}

export function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function adjustToPreviousWorkingDay(dateIso: string, holidays: Set<string>): string {
  let d = parseDateOnly(dateIso);
  for (let i = 0; i < 14; i++) {
    if (!isNonWorkingDaySync(d, holidays)) {
      return formatDateIso(d);
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12, 0, 0);
  }
  return formatDateIso(d);
}

/** 租金帳單月起始日（第 2 期 = 入住月） */
export function computeRentBillingMonthStart(moveInDate: string, periodIndex: number): string {
  const base = parseDateOnly(moveInDate);
  const billing = new Date(base.getFullYear(), base.getMonth() + (periodIndex - 2), 1, 12, 0, 0);
  return formatDateIso(billing);
}

/** 租金繳付期限：帳單月之下月 7 日（遇假期提前） */
export function computeRentPaymentDeadline(
  moveInDate: string,
  periodIndex: number,
  holidays: Set<string>
): string {
  const billingStart = computeRentBillingMonthStart(moveInDate, periodIndex);
  const billing = parseDateOnly(billingStart);
  const raw = new Date(billing.getFullYear(), billing.getMonth() + 1, 7, 12, 0, 0);
  return adjustToPreviousWorkingDay(formatDateIso(raw), holidays);
}

/** 水電煤：上傳後第 21 日 23:59（遇假期提前） */
export function computeUtilityPaymentDeadline(uploadAtIso: string, holidays: Set<string>): string {
  const upload = parseDateOnly(uploadAtIso.slice(0, 10));
  const raw = new Date(upload.getFullYear(), upload.getMonth(), upload.getDate() + 21, 12, 0, 0);
  return adjustToPreviousWorkingDay(formatDateIso(raw), holidays);
}

export async function getHolidaySet(): Promise<Set<string>> {
  return loadHolidaySet();
}

export function formatDeadlineLabel(deadlineIso: string): string {
  return `${parseDateOnly(deadlineIso).toLocaleDateString('zh-HK')} 23:59 前`;
}

export function isOnOrBeforeDeadline(deadlineIso: string): boolean {
  return appTodayIso() <= deadlineIso;
}

export function isPastDeadline(deadlineIso: string): boolean {
  return appTodayIso() > deadlineIso;
}
