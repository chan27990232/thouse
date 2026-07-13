import { Globe } from 'lucide-react';
import { LOCALE_LABELS, LOCALE_MENU_LABELS, type AppLocale } from '../lib/locale';
import { useLocale } from '../context/LocaleContext';
import { cn } from './ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const LOCALES: AppLocale[] = ['zh-TW', 'zh-CN', 'en'];

type LanguageSwitcherProps = {
  variant?: 'hero' | 'default';
  className?: string;
  /** 用於全螢幕子頁（如資訊頁 overlay），避免選單被較高 z-index 遮住 */
  menuClassName?: string;
};

export function LanguageSwitcher({ variant = 'hero', className, menuClassName }: LanguageSwitcherProps) {
  const { locale, setLocale, commonT } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={commonT.languageAria}
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center text-base leading-none transition-colors sm:h-10 sm:w-10',
            variant === 'hero'
              ? 'rounded-full border border-white/80 bg-white text-gray-800 shadow-sm hover:bg-gray-50'
              : 'rounded-full border border-gray-200 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 sm:p-2.5',
            className,
          )}
        >
          <Globe className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('min-w-[9rem]', menuClassName)}>
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v as AppLocale)}>
          {LOCALES.map((loc) => (
            <DropdownMenuRadioItem key={loc} value={loc} className="cursor-pointer">
              <span className="font-medium">{LOCALE_MENU_LABELS[loc]}</span>
              <span className="ml-auto text-xs text-gray-500">{LOCALE_LABELS[loc]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
