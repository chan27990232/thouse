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
import { buildNoticeT, type NoticeMessages } from '../content/translations/notice';
import { buildChatT, type ChatMessages } from '../content/translations/chat';
import { buildFiltersT, type FiltersMessages } from '../content/translations/filters';
import { buildPropertyT, type PropertyMessages } from '../content/translations/property';
import { buildProfileT, type ProfileMessages } from '../content/translations/profile';
import { buildContactLandlordT, type ContactLandlordMessages } from '../content/translations/contactLandlord';
import { buildRentalApplicationT, type RentalApplicationMessages } from '../content/translations/rentalApplication';
import { buildPaymentT, type PaymentMessages } from '../content/translations/payment';
import { buildLeaseWorkflowT, type LeaseWorkflowMessages } from '../content/translations/leaseWorkflow';
import { buildLandlordWalletT, type LandlordWalletMessages } from '../content/translations/landlordWallet';
import { buildUtilityBillT, type UtilityBillMessages } from '../content/translations/utilityBill';
import { buildListPropertyT, type ListPropertyMessages } from '../content/translations/listProperty';
import { buildPropertyManagementT, type PropertyManagementMessages } from '../content/translations/propertyManagement';
import { buildTenantMyPropertiesT, type TenantMyPropertiesMessages } from '../content/translations/tenantMyProperties';
import { formatMessage } from '../lib/i18nFormat';
import {
  extractPropertyAreaFromTitle,
  localizePropertyDistrict,
  localizePropertyText,
  localizePropertyTitle,
} from '../lib/localizePropertyText';

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
  noticeT: NoticeMessages & {
    format: (key: keyof NoticeMessages, vars?: Record<string, string | number>) => string;
  };
  chatT: ChatMessages & {
    format: (key: keyof ChatMessages, vars?: Record<string, string | number>) => string;
  };
  filtersT: FiltersMessages & {
    format: (key: keyof FiltersMessages, vars?: Record<string, string | number>) => string;
    amenity: (name: string) => string;
  };
  propertyT: PropertyMessages & {
    format: (key: keyof PropertyMessages, vars?: Record<string, string | number>) => string;
  };
  profileT: ProfileMessages & {
    format: (key: keyof ProfileMessages, vars?: Record<string, string | number>) => string;
  };
  contactLandlordT: ContactLandlordMessages & {
    format: (key: keyof ContactLandlordMessages, vars?: Record<string, string | number>) => string;
  };
  rentalApplicationT: RentalApplicationMessages & {
    format: (key: keyof RentalApplicationMessages, vars?: Record<string, string | number>) => string;
  };
  paymentT: PaymentMessages & {
    format: (key: keyof PaymentMessages, vars?: Record<string, string | number>) => string;
    paymentMethodLabel: (method: import('../lib/leaseFirstPayment').PaymentMethodCode) => string;
  };
  leaseWorkflowT: ReturnType<typeof buildLeaseWorkflowT>;
  landlordWalletT: LandlordWalletMessages & ReturnType<typeof buildLandlordWalletT>;
  utilityBillT: UtilityBillMessages & ReturnType<typeof buildUtilityBillT>;
  listPropertyT: ListPropertyMessages & ReturnType<typeof buildListPropertyT>;
  propertyManagementT: PropertyManagementMessages & ReturnType<typeof buildPropertyManagementT>;
  tenantMyPropertiesT: TenantMyPropertiesMessages & ReturnType<typeof buildTenantMyPropertiesT>;
  localizePropertyTitle: (title: string) => string;
  localizePropertyText: (text: string) => string;
  localizePropertyDistrict: (district?: string | null) => string;
  extractPropertyAreaFromTitle: (title: string) => string | null;
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
  const noticeT = useMemo(() => buildNoticeT(locale), [locale]);
  const chatT = useMemo(() => buildChatT(locale), [locale]);
  const filtersT = useMemo(() => buildFiltersT(locale), [locale]);
  const propertyT = useMemo(() => buildPropertyT(locale), [locale]);
  const profileT = useMemo(() => buildProfileT(locale), [locale]);
  const contactLandlordT = useMemo(() => buildContactLandlordT(locale), [locale]);
  const rentalApplicationT = useMemo(() => buildRentalApplicationT(locale), [locale]);
  const paymentT = useMemo(() => buildPaymentT(locale), [locale]);
  const leaseWorkflowT = useMemo(() => buildLeaseWorkflowT(locale), [locale]);
  const landlordWalletT = useMemo(() => buildLandlordWalletT(locale), [locale]);
  const utilityBillT = useMemo(() => buildUtilityBillT(locale), [locale]);
  const listPropertyT = useMemo(() => buildListPropertyT(locale), [locale]);
  const propertyManagementT = useMemo(() => buildPropertyManagementT(locale), [locale]);
  const tenantMyPropertiesT = useMemo(() => buildTenantMyPropertiesT(locale), [locale]);

  const localizePropertyTitleFn = useCallback(
    (title: string) => localizePropertyTitle(title, locale),
    [locale],
  );
  const localizePropertyTextFn = useCallback(
    (text: string) => localizePropertyText(text, locale),
    [locale],
  );
  const localizePropertyDistrictFn = useCallback(
    (district?: string | null) => localizePropertyDistrict(district, locale),
    [locale],
  );
  const extractPropertyAreaFromTitleFn = useCallback(
    (title: string) => extractPropertyAreaFromTitle(title, locale),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      homeT,
      landlordT,
      commonT,
      authT,
      noticeT,
      chatT,
      filtersT,
      propertyT,
      profileT,
      contactLandlordT,
      rentalApplicationT,
      paymentT,
      leaseWorkflowT,
      landlordWalletT,
      utilityBillT,
      listPropertyT,
      propertyManagementT,
      tenantMyPropertiesT,
      localizePropertyTitle: localizePropertyTitleFn,
      localizePropertyText: localizePropertyTextFn,
      localizePropertyDistrict: localizePropertyDistrictFn,
      extractPropertyAreaFromTitle: extractPropertyAreaFromTitleFn,
    }),
    [
      locale,
      setLocale,
      homeT,
      landlordT,
      commonT,
      authT,
      noticeT,
      chatT,
      filtersT,
      propertyT,
      profileT,
      contactLandlordT,
      rentalApplicationT,
      paymentT,
      leaseWorkflowT,
      landlordWalletT,
      utilityBillT,
      listPropertyT,
      propertyManagementT,
      tenantMyPropertiesT,
      localizePropertyTitleFn,
      localizePropertyTextFn,
      localizePropertyDistrictFn,
      extractPropertyAreaFromTitleFn,
    ],
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
