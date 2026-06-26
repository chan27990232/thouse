import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';

const commonZhTW = {
  back: '返回',
  viewProperty: '查看 {title}',
  addFavorite: '加入收藏',
  removeFavorite: '取消收藏',
  sqftUnit: '平方呎',
  bedrooms: '臥室',
  bathrooms: '浴室',
  floorUnit: '樓',
  perMonth: '/月',
  rentCta: '租借',
  buildingAgeNew: '5年以下',
  buildingAge5_10: '5–10年',
  buildingAge10_20: '10–20年',
  buildingAge20Plus: '20年以上',
  footerNavAria: '頁尾導覽',
  companyLegalName: '簡屋有限公司',
  copyright: '©{year} 簡屋有限公司 版權所有 不得轉載',
  logoAlt: 'Thouse 簡屋',
} as const;

export type CommonMessages = typeof commonZhTW;

const commonZhCN: CommonMessages = {
  back: '返回',
  viewProperty: '查看 {title}',
  addFavorite: '加入收藏',
  removeFavorite: '取消收藏',
  sqftUnit: '平方呎',
  bedrooms: '卧室',
  bathrooms: '浴室',
  floorUnit: '楼',
  perMonth: '/月',
  rentCta: '租借',
  buildingAgeNew: '5年以下',
  buildingAge5_10: '5–10年',
  buildingAge10_20: '10–20年',
  buildingAge20Plus: '20年以上',
  footerNavAria: '页尾导航',
  companyLegalName: '简屋有限公司',
  copyright: '©{year} 简屋有限公司 版权所有 不得转载',
  logoAlt: 'Thouse 简屋',
};

const commonEn: CommonMessages = {
  back: 'Back',
  viewProperty: 'View {title}',
  addFavorite: 'Add to favorites',
  removeFavorite: 'Remove from favorites',
  sqftUnit: 'sq ft',
  bedrooms: 'beds',
  bathrooms: 'baths',
  floorUnit: 'F',
  perMonth: '/mo',
  rentCta: 'Rent',
  buildingAgeNew: 'Under 5 yrs',
  buildingAge5_10: '5–10 yrs',
  buildingAge10_20: '10–20 yrs',
  buildingAge20Plus: '20+ yrs',
  footerNavAria: 'Footer navigation',
  companyLegalName: 'Thouse Limited',
  copyright: '©{year} Thouse Limited. All rights reserved.',
  logoAlt: 'Thouse',
};

export const commonMessages: Record<AppLocale, CommonMessages> = {
  'zh-TW': commonZhTW,
  'zh-CN': commonZhCN,
  en: commonEn,
};

export function buildCommonT(locale: AppLocale) {
  const messages = commonMessages[locale];
  return {
    ...messages,
    format(key: keyof CommonMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
  };
}
