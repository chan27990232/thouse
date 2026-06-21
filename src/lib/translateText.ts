import type { AppLocale } from './locale';

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function langPairForLocale(text: string, locale: AppLocale): string | null {
  const cjk = hasCjk(text);
  if (locale === 'en') {
    return cjk ? 'zh-TW|en' : null;
  }
  if (locale === 'zh-CN') {
    return cjk ? 'zh-TW|zh-CN' : 'en|zh-CN';
  }
  return cjk ? 'zh-CN|zh-TW' : 'en|zh-TW';
}

export async function translateTextForLocale(text: string, locale: AppLocale): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const langpair = langPairForLocale(trimmed, locale);
  if (!langpair) return trimmed;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${langpair}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('翻譯服務暫時無法使用');

  const data = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };

  const translated = data.responseData?.translatedText?.trim();
  if (!translated || data.responseStatus === 429) {
    throw new Error('翻譯服務繁忙，請稍後再試');
  }

  return translated;
}
