import { CalendarClock } from 'lucide-react';
import { appTodayIso, isMockDateActive, isProductionMockDate } from '../lib/appClock';

export function MockDateDevBanner() {
  if (!isMockDateActive()) return null;

  const isProduction = isProductionMockDate();

  return (
    <div
      className={
        isProduction
          ? 'border-b border-red-300 bg-red-50 px-4 py-2'
          : 'border-b border-amber-200 bg-amber-50 px-4 py-2'
      }
    >
      <div
        className={`mx-auto flex max-w-6xl items-center gap-2 text-xs ${
          isProduction ? 'text-red-950' : 'text-amber-950'
        }`}
      >
        <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
        <p>
          {isProduction ? (
            <>
              <strong>Production 測試模式</strong> · 模擬今日：<strong>{appTodayIso()}</strong>
              <span className="ml-2 opacity-80">
                （Vercel 設了 VITE_MOCK_TODAY + VITE_ENABLE_MOCK_TODAY=true；測完請刪除並重新 deploy）
              </span>
            </>
          ) : (
            <>
              開發模式 · 模擬今日：<strong>{appTodayIso()}</strong>
              <span className="ml-2 text-amber-800/80">
                （由 .env.local 的 VITE_MOCK_TODAY 設定；修改後須重啟 npm run dev）
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
