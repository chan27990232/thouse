import { useEffect } from 'react';
import { INFO_PAGES, type InfoPageId } from '../../content/infoPages';

type StaticInfoPageProps = {
  id: InfoPageId;
  onClose: () => void;
};

export function StaticInfoPage({ id, onClose }: StaticInfoPageProps) {
  const { title, paragraphs } = INFO_PAGES[id];

  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 isolate flex min-h-[100dvh] flex-col bg-white text-gray-900"
      style={{ zIndex: 100000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="static-info-title"
    >
      <header className="relative z-30 flex min-h-14 shrink-0 items-center border-b border-gray-200 bg-white py-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:min-h-16 sm:py-3.5 lg:min-h-[4.25rem] lg:py-4">
        <h1
          id="static-info-title"
          className="pointer-events-none absolute inset-0 z-10 flex min-h-14 select-none items-center justify-center px-14 text-center text-base font-semibold leading-snug sm:min-h-16 sm:px-20 sm:text-lg lg:min-h-[4.25rem] lg:px-24 lg:text-xl"
        >
          <span className="pointer-events-none line-clamp-2 max-w-2xl">{title}</span>
        </h1>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto absolute left-2 top-1/2 z-50 -translate-y-1/2 cursor-pointer touch-manipulation rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 active:bg-gray-200 sm:left-3 lg:left-10 lg:px-4 lg:text-base"
        >
          返回
        </button>
      </header>
      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth bg-white px-4 py-6 sm:px-8 sm:py-8 lg:px-16 lg:py-10 xl:px-20">
        <div className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed sm:text-base lg:max-w-3xl lg:space-y-5 lg:text-[17px] lg:leading-8">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-wrap text-gray-800">
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
