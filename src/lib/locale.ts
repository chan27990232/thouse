export type AppLocale = 'zh-TW' | 'zh-CN' | 'en';

export const LOCALE_STORAGE_KEY = 'thouse_locale';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-TW': '繁',
  'zh-CN': '簡',
  en: 'Eng',
};

export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  'zh-TW': 'zh-Hant',
  'zh-CN': 'zh-Hans',
  en: 'en',
};

export function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'zh-TW';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'zh-TW' || stored === 'zh-CN' || stored === 'en') return stored;
  return 'zh-TW';
}
