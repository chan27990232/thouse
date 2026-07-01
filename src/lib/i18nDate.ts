import type { AppLocale } from './locale';

export function formatLocaleDateTime(iso: string, locale: AppLocale): string {
  try {
    const tag = locale === 'en' ? 'en-HK' : locale === 'zh-CN' ? 'zh-CN' : 'zh-HK';
    return new Date(iso).toLocaleString(tag, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatLocaleDateTimeLong(iso: string, locale: AppLocale): string {
  try {
    const tag = locale === 'en' ? 'en-HK' : locale === 'zh-CN' ? 'zh-CN' : 'zh-HK';
    return new Date(iso).toLocaleString(tag, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
