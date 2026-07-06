import type { ReactNode } from 'react';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { getFooterLinks } from '../content/infoPages';
import { useInfoPages } from '../context/InfoPagesContext';
import { useLocale } from '../context/LocaleContext';
import { cn } from './ui/utils';

const FOOTER_BG = '#3b3b3b' as const;
const LINE = '1px solid rgba(255, 255, 255, 0.14)';

function SocialIcon({
  children,
  label,
  href,
  className,
}: {
  children: ReactNode;
  label: string;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-white bg-black/50',
        'transition-colors transition-transform duration-150 ease-out',
        'hover:border-white hover:bg-black hover:-translate-y-0.5 hover:shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b3b3b]',
        className,
      )}
    >
      {children}
    </a>
  );
}

type ThouseHomeFooterProps = {
  className?: string;
};

export function ThouseHomeFooter({ className }: ThouseHomeFooterProps) {
  const { openInfoPage } = useInfoPages();
  const { locale, commonT } = useLocale();
  const footerLinks = getFooterLinks(locale);
  const year = new Date().getFullYear();

  return (
    <footer
      id="thouse-page-footer"
      className={cn('w-full shrink-0 text-[11px] sm:text-xs relative z-10', className)}
      style={{ backgroundColor: FOOTER_BG, color: '#e8e8e8', borderTop: LINE }}
    >
      <div className="w-full" style={{ borderBottom: LINE }}>
        <div className="max-w-[1360px] mx-auto px-6 py-4">
          <nav
            className="flex flex-wrap items-center justify-center gap-y-3 text-sm sm:text-base font-normal tracking-wide"
            aria-label={commonT.footerNavAria}
          >
            {footerLinks.map(({ label, id }, index) => (
              <span key={id} className="inline-flex items-center shrink-0">
                {index > 0 ? (
                  <span className="mx-3 sm:mx-5 md:mx-7 text-gray-400 select-none" aria-hidden>
                    |
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => openInfoPage(id)}
                  className="px-2 py-2 rounded-sm text-left text-white transition-colors hover:underline hover:underline-offset-4"
                >
                  {label}
                </button>
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="w-full">
        <div className="max-w-[1360px] mx-auto px-6 py-8">
          <div
            className="flex flex-col gap-4 sm:flex-row sm:items-center pb-6"
            style={{ borderBottom: LINE }}
          >
            <div className="flex min-w-0 items-center gap-8 sm:gap-10 md:gap-12">
              <img
                src={thouseLogo}
                alt={commonT.logoAlt}
                className="h-12 w-12 shrink-0 object-contain"
              />
              <p className="min-w-0 text-left text-sm sm:text-base leading-snug">
                <span className="font-normal tracking-[0.12em] text-gray-300">THOUSE</span>
                <span className="text-white/90"> </span>
                <span className="font-semibold text-white">{commonT.companyLegalName}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-6">
            <p className="order-2 sm:order-1 text-center sm:text-left text-sm text-gray-400 leading-relaxed">
              {commonT.format('copyright', { year })}
            </p>
            <div className="flex items-center justify-center sm:justify-end gap-3 order-1 sm:order-2">
              <SocialIcon
                label={commonT.instagramAria}
                href="https://www.instagram.com/thouse.hk?igsh=dzJvbjlkYmswdmti&utm_source=qr"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </SocialIcon>
              <SocialIcon
                label={commonT.facebookAria}
                href="https://www.facebook.com/share/187LXqY1Yd/?mibextid=wwXIfr"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5H17V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.3v2.1H7.8V14h2.6v8h3.1Z" />
                </svg>
              </SocialIcon>
              <SocialIcon
                label={commonT.douyinAria}
                href="https://v.douyin.com/dnLab1O070U/"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M14.2 3.2c.6 2.2 1.9 3.9 4 4.9v3.2c-1.5-.1-2.8-.5-4-1.3v6.3a6.2 6.2 0 1 1-6.2-6.2c.4 0 .8 0 1.2.1v3.2a3.5 3.5 0 1 0 1.8 3v-13h3.2Z" />
                </svg>
              </SocialIcon>
              <SocialIcon
                label={commonT.xiaohongshuAria}
                href="https://xhslink.com/m/P63kWZDhqw"
                className="overflow-hidden p-0"
              >
                <img
                  src="/xiaohongshu-logo.png"
                  alt=""
                  className="h-full w-full object-cover"
                  aria-hidden
                  style={{ filter: 'grayscale(1) contrast(10) brightness(1.1)' }}
                />
              </SocialIcon>
              <SocialIcon
                label={commonT.wechatAria}
                href="https://u.wechat.com/IAt7G2Q1pvX_K0RRdOGcPWQ?s=2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M9.5 4C6.46 4 4 6.13 4 8.75c0 1.57.88 2.97 2.25 3.85-.14.52-.58 1.95-.58 1.95s2.02-.64 3.08-.98c.56.1 1.14.18 1.75.18 3.04 0 5.5-2.13 5.5-4.75S12.54 4 9.5 4zM16 11.5c-2.76 0-5 1.79-5 4s2.24 4 5 4c.55 0 1.08-.08 1.58-.23l1.94.62-.47-1.48c.99-.8 1.6-1.9 1.6-3.11 0-2.21-2.24-4-5-4z" />
                </svg>
              </SocialIcon>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
