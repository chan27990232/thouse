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
import { buildLandlordT, type LandlordMessages } from '../content/translations/landlord';
import { buildCommonT, type CommonMessages } from '../content/translations/common';
import { authMessages, type AuthMessages } from '../content/translations/auth';
import { formatMessage } from '../lib/i18nFormat';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  homeT: HomeMessages & {
    format: (key: keyof HomeMessages, vars?: Record<string, string | number>) => string;
  };
  landlordT: LandlordMessages & {
    format: (key: keyof LandlordMessages, vars?: Record<string, string | number>) => string;
  };
  commonT: CommonMessages & {
    format: (key: keyof CommonMessages, vars?: Record<string, string | number>) => string;
  };
  authT: AuthMessages & {
    format: (key: keyof AuthMessages, vars?: Record<string, string | number>) => string;
  };
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function withFormat<T extends Record<string, string>>(messages: T) {
  return {
    ...messages,
    format(key: keyof T, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
  };
}

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

  const landlordT = useMemo(() => buildLandlordT(locale), [locale]);
  const commonT = useMemo(() => buildCommonT(locale), [locale]);
  const authT = useMemo(() => withFormat(authMessages[locale]), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, homeT, landlordT, commonT, authT }),
    [locale, setLocale, homeT, landlordT, commonT, authT],
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
