import type { AppLocale } from './locale';

/** 首頁／搜尋「按地區」選項（香港十八區，value 為繁中 canonical） */
export const HK_DISTRICTS = [
  '中西區',
  '東區',
  '南區',
  '灣仔區',
  '九龍城區',
  '油尖旺區',
  '深水埗區',
  '黃大仙區',
  '觀塘區',
  '大埔區',
  '元朗區',
  '屯門區',
  '北區',
  '西貢區',
  '沙田區',
  '荃灣區',
  '葵青區',
  '離島區',
] as const;

export const DISTRICT_LABELS: Record<string, Record<AppLocale, string>> = {
  中西區: { 'zh-TW': '中西區', 'zh-CN': '中西区', en: 'Central & Western' },
  東區: { 'zh-TW': '東區', 'zh-CN': '东区', en: 'Eastern' },
  南區: { 'zh-TW': '南區', 'zh-CN': '南区', en: 'Southern' },
  灣仔區: { 'zh-TW': '灣仔區', 'zh-CN': '湾仔区', en: 'Wan Chai' },
  九龍城區: { 'zh-TW': '九龍城區', 'zh-CN': '九龙城区', en: 'Kowloon City' },
  油尖旺區: { 'zh-TW': '油尖旺區', 'zh-CN': '油尖旺区', en: 'Yau Tsim Mong' },
  深水埗區: { 'zh-TW': '深水埗區', 'zh-CN': '深水埗区', en: 'Sham Shui Po' },
  黃大仙區: { 'zh-TW': '黃大仙區', 'zh-CN': '黄大仙区', en: 'Wong Tai Sin' },
  觀塘區: { 'zh-TW': '觀塘區', 'zh-CN': '观塘区', en: 'Kwun Tong' },
  大埔區: { 'zh-TW': '大埔區', 'zh-CN': '大埔区', en: 'Tai Po' },
  元朗區: { 'zh-TW': '元朗區', 'zh-CN': '元朗区', en: 'Yuen Long' },
  屯門區: { 'zh-TW': '屯門區', 'zh-CN': '屯门区', en: 'Tuen Mun' },
  北區: { 'zh-TW': '北區', 'zh-CN': '北区', en: 'North' },
  西貢區: { 'zh-TW': '西貢區', 'zh-CN': '西贡区', en: 'Sai Kung' },
  沙田區: { 'zh-TW': '沙田區', 'zh-CN': '沙田区', en: 'Sha Tin' },
  荃灣區: { 'zh-TW': '荃灣區', 'zh-CN': '荃湾区', en: 'Tsuen Wan' },
  葵青區: { 'zh-TW': '葵青區', 'zh-CN': '葵青区', en: 'Kwai Tsing' },
  離島區: { 'zh-TW': '離島區', 'zh-CN': '离岛区', en: 'Islands' },
};

export function getDistrictLabel(district: string, locale: AppLocale): string {
  return DISTRICT_LABELS[district]?.[locale] ?? district;
}

/** 物業是否屬於所選十八區（比對 DB district 欄位；標題作後備）。 */
export function propertyMatchesDistrict(
  property: { district?: string | null; title: string },
  selectedDistrict: string,
): boolean {
  const district = selectedDistrict.trim();
  if (!district) return true;

  const stored = (property.district ?? '').trim();
  if (stored && stored === district) return true;

  const core = district.replace(/區$/, '');
  const title = property.title ?? '';
  if (core.length >= 2 && title.includes(core)) return true;
  if (title.includes(district)) return true;
  if (stored && stored.includes(core)) return true;

  return false;
}
