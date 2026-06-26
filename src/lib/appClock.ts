/**
 * 應用程式「今天」— 可用 VITE_MOCK_TODAY 模擬日期以測試租金到期。
 * - 本機 dev：設 VITE_MOCK_TODAY 即可
 * - Production：另須設 VITE_ENABLE_MOCK_TODAY=true，測完請移除並重新 deploy
 * 例：VITE_MOCK_TODAY=2026-07-10
 */
function getMockTodayIso(): string | null {
  const mock = (import.meta.env.VITE_MOCK_TODAY as string | undefined)?.trim();
  if (!mock) return null;

  if (import.meta.env.DEV) return mock;

  const enabled = (import.meta.env.VITE_ENABLE_MOCK_TODAY as string | undefined)?.trim();
  if (enabled === 'true' || enabled === '1') return mock;

  return null;
}

export function appToday(): Date {
  const mock = getMockTodayIso();
  if (mock) {
    return new Date(`${mock}T12:00:00`);
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
  return getMockTodayIso() !== null;
}

export function isProductionMockDate(): boolean {
  return !import.meta.env.DEV && isMockDateActive();
}
