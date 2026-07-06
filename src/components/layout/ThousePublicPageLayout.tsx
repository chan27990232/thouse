import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThouseHomeFooter } from '../ThouseHomeFooter';
import { useLocale } from '../../context/LocaleContext';

const NAVY = '#1a365d' as const;

type ThousePublicPageLayoutProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
};

export function ThousePublicPageLayout({
  title,
  onBack,
  children,
}: ThousePublicPageLayoutProps) {
  const { homeT } = useLocale();

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-white">
      <header className="sticky top-0 z-50 shrink-0 border-b border-gray-200/80 bg-white/95 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-4 md:px-8 lg:px-10">
        <div className="flex min-h-14 items-center justify-between gap-2 py-2">
          <button
            type="button"
            onClick={onBack}
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-1.5 py-1 pr-2.5 text-gray-900 shadow-sm transition-colors hover:bg-gray-50 sm:px-2 sm:py-1.5 sm:pr-3"
            aria-label={homeT.home}
          >
            <img src={thouseLogo} alt={homeT.brandName} className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
            <span className="hidden text-sm font-medium sm:inline md:text-base">{homeT.brandName}</span>
          </button>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher variant="default" menuClassName="z-[100001]" />
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 sm:px-3 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative w-full min-w-0">
        <div className="relative h-[min(48vh,520px)] min-h-[300px] w-full max-h-[560px] overflow-hidden sm:min-h-[320px]">
          <img
            src="/thouse-banner.png"
            alt={homeT.bannerAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-black/20"
            aria-hidden
          />
          <div className="relative z-10 flex h-full flex-col items-center justify-end pb-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] text-center sm:px-4 sm:pb-6 md:px-10 md:pb-8 lg:px-14">
            <div className="max-w-3xl">
              <h1
                className="text-[clamp(2rem,7.5vw,3.25rem)] font-bold leading-[1.15] drop-shadow-sm sm:text-[2.75rem] sm:leading-tight md:text-[3.25rem] lg:text-[3.75rem]"
                style={{ color: NAVY }}
              >
                {title}
              </h1>
            </div>
          </div>
        </div>

        <div className="relative z-20 w-full -mt-[clamp(8rem,32vw,16rem)] px-2 pb-6 sm:-mt-[clamp(5rem,14vw,10rem)] sm:px-4 md:px-6 lg:-mt-[clamp(5.5rem,12vw,11rem)]">
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200/90 bg-white p-5 text-center shadow-lg sm:rounded-3xl sm:p-8 md:p-10 md:shadow-[0_12px_40px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)]">
            {children}
          </div>
        </div>
      </div>

      <div className="flex-1" aria-hidden />

      <ThouseHomeFooter className="mt-auto" />
    </div>
  );
}
