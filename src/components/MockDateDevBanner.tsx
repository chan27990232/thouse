import { CalendarClock } from 'lucide-react';
import { appTodayIso, isMockDateActive } from '../lib/appClock';

export function MockDateDevBanner() {
  if (!isMockDateActive()) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center gap-2 text-xs text-amber-950">
        <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
        <p>
          開發模式 · 模擬今日：<strong>{appTodayIso()}</strong>
          <span className="ml-2 text-amber-800/80">
            （由 .env.local 的 VITE_MOCK_TODAY 設定；修改後須重啟 npm run dev）
          </span>
        </p>
      </div>
    </div>
  );
}
