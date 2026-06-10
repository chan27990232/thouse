/**
 * 應用程式「今天」— 開發時可用 VITE_MOCK_TODAY 模擬日期以測試租金到期。
 * 例：VITE_MOCK_TODAY=2026-07-10
 */
export function appToday(): Date {
  const mock = import.meta.env.VITE_MOCK_TODAY as string | undefined;
  if (import.meta.env.DEV && mock?.trim()) {
    return new Date(`${mock.trim()}T12:00:00`);
  }
  return new Date();
}

/** YYYY-MM-DD（本地日曆日，避免 UTC 偏移） */
export function appTodayIso(): string {
  const d = appToday();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function isMockDateActive(): boolean {
  return import.meta.env.DEV && Boolean((import.meta.env.VITE_MOCK_TODAY as string | undefined)?.trim());
}
