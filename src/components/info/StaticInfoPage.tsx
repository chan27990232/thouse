import { useEffect, useRef } from 'react';
import { getInfoPages, type InfoPageId } from '../../content/infoPages';
import { useLocale } from '../../context/LocaleContext';
import { ThousePublicPageLayout } from '../layout/ThousePublicPageLayout';

type StaticInfoPageProps = {
  id: InfoPageId;
  onClose: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StaticInfoPage({ id, onClose }: StaticInfoPageProps) {
  const { locale } = useLocale();
  const { title, paragraphs } = getInfoPages(locale)[id];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [id]);

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-[100000] overflow-y-auto overscroll-y-contain bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="static-info-title"
    >
      <ThousePublicPageLayout title={title} onBack={onClose}>
        <div id="static-info-title" className="sr-only">
          {title}
        </div>
        <div className="mx-auto max-w-2xl space-y-4 text-center text-sm leading-relaxed text-gray-800 sm:space-y-5 sm:text-base sm:leading-8">
          {paragraphs.map((p, i) => {
            if (id === 'contact' && EMAIL_RE.test(p.trim())) {
              return (
                <p key={i}>
                  <a
                    href={`mailto:${p.trim()}`}
                    className="font-medium underline underline-offset-4 transition-colors hover:text-[#1a365d]"
                    style={{ color: '#1a365d' }}
                  >
                    {p}
                  </a>
                </p>
              );
            }
            return (
              <p key={i} className="whitespace-pre-wrap">
                {p}
              </p>
            );
          })}
        </div>
      </ThousePublicPageLayout>
    </div>
  );
}
