import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';

const responseTimeZhTW = {
  noData: '暫無數據',
  withinHour: '1 小時內',
  withinHours: '{hours} 小時內',
  withinDay: '1 日內',
  withinDays: '{days} 日內',
} as const;

export type ResponseTimeMessages = typeof responseTimeZhTW;

const responseTimeZhCN: ResponseTimeMessages = {
  noData: '暂无数据',
  withinHour: '1 小时内',
  withinHours: '{hours} 小时内',
  withinDay: '1 日内',
  withinDays: '{days} 日内',
};

const responseTimeEn: ResponseTimeMessages = {
  noData: 'No Data Yet',
  withinHour: 'Within 1 hour',
  withinHours: 'Within {hours} hours',
  withinDay: 'Within 1 day',
  withinDays: 'Within {days} days',
};

export const responseTimeMessages: Record<AppLocale, ResponseTimeMessages> = {
  'zh-TW': responseTimeZhTW,
  'zh-CN': responseTimeZhCN,
  en: responseTimeEn,
};

export function buildResponseTimeT(locale: AppLocale) {
  const messages = responseTimeMessages[locale];
  return {
    ...messages,
    format(key: keyof ResponseTimeMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
  };
}
