import { LOCALE_LABELS, type AppLocale } from '../lib/locale';
import { useLocale } from '../context/LocaleContext';
import { cn } from './ui/utils';

const LOCALES: AppLocale[] = ['zh-TW', 'zh-CN', 'en'];

type LanguageSwitcherProps = {
  variant?: 'hero' | 'default';
  className?: string;
};

export function LanguageSwitcher({ variant = 'hero', className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        'inline-flex shrink-0 items-center rounded-full p-0.5 text-[10px] leading-none sm:text-[11px]',
        variant === 'hero'
          ? 'border border-white/80 bg-white shadow-sm'
          : 'border border-gray-200 bg-gray-100',
        className
      )}
    >
      {LOCALES.map((loc) => {
        const active = locale === loc;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            aria-pressed={active}
            className={cn(
              'rounded-full px-1.5 py-1 transition-colors sm:px-2 sm:py-1.5',
              active
                ? variant === 'hero'
                  ? 'bg-gray-900 font-medium text-white'
                  : 'bg-gray-900 font-medium text-white'
                : variant === 'hero'
                  ? 'text-gray-600 hover:bg-gray-50'
                  : 'text-gray-600 hover:bg-gray-200/80'
            )}
          >
            {LOCALE_LABELS[loc]}
          </button>
        );
      })}
    </div>
  );
}
