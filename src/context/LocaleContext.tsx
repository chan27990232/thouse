import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type AppLocale,
  LOCALE_HTML_LANG,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
} from '../lib/locale';
import { formatHomeMessage, homeMessages, type HomeMessages } from '../content/translations/home';
import { landlordMessages, type LandlordMessages } from '../content/translations/landlord';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  homeT: HomeMessages & {
    format: (key: keyof HomeMessages, vars?: Record<string, string | number>) => string;
  };
  landlordT: LandlordMessages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale());

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = LOCALE_HTML_LANG[locale];
  }, [locale]);

  const homeT = useMemo(() => {
    const messages = homeMessages[locale];
    return {
      ...messages,
      format(key: keyof HomeMessages, vars?: Record<string, string | number>) {
        return formatHomeMessage(messages[key], vars);
      },
    };
  }, [locale]);

  const landlordT = useMemo(() => landlordMessages[locale], [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, homeT, landlordT }),
    [locale, setLocale, homeT, landlordT]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
