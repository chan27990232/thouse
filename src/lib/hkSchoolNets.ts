import type { AppLocale } from './locale';

/** 香港小學校網（常見搜尋格式） */
export const HK_SCHOOL_NETS = [
  '中西區11校網',
  '灣仔12校網',
  '東區14校網',
  '南區18校網',
  '油尖旺31校網',
  '油尖旺32校網',
  '深水埗40校網',
  '九龍城41校網',
  '黃大仙45校網',
  '觀塘46校網',
  '葵青62校網',
  '荃灣62校網',
  '屯門70校網',
  '屯門71校網',
  '元朗72校網',
  '元朗73校網',
  '元朗74校網',
  '北區80校網',
  '北區81校網',
  '北區83校網',
  '大埔84校網',
  '大埔89校網',
  '沙田88校網',
  '沙田91校網',
  '西貢95校網',
  '離島98校網',
  '離島99校網',
] as const;

export type HkSchoolNet = (typeof HK_SCHOOL_NETS)[number];

const SCHOOL_NET_LABELS: Record<string, Record<AppLocale, string>> = {
  中西區11校網: { 'zh-TW': '中西區11校網', 'zh-CN': '中西区11校网', en: 'Central & Western (NET 11)' },
  灣仔12校網: { 'zh-TW': '灣仔12校網', 'zh-CN': '湾仔12校网', en: 'Wan Chai (NET 12)' },
  東區14校網: { 'zh-TW': '東區14校網', 'zh-CN': '东区14校网', en: 'Eastern (NET 14)' },
  南區18校網: { 'zh-TW': '南區18校網', 'zh-CN': '南区18校网', en: 'Southern (NET 18)' },
  油尖旺31校網: { 'zh-TW': '油尖旺31校網', 'zh-CN': '油尖旺31校网', en: 'Yau Tsim Mong (NET 31)' },
  油尖旺32校網: { 'zh-TW': '油尖旺32校網', 'zh-CN': '油尖旺32校网', en: 'Yau Tsim Mong (NET 32)' },
  深水埗40校網: { 'zh-TW': '深水埗40校網', 'zh-CN': '深水埗40校网', en: 'Sham Shui Po (NET 40)' },
  九龍城41校網: { 'zh-TW': '九龍城41校網', 'zh-CN': '九龙城41校网', en: 'Kowloon City (NET 41)' },
  黃大仙45校網: { 'zh-TW': '黃大仙45校網', 'zh-CN': '黄大仙45校网', en: 'Wong Tai Sin (NET 45)' },
  觀塘46校網: { 'zh-TW': '觀塘46校網', 'zh-CN': '观塘46校网', en: 'Kwun Tong (NET 46)' },
  葵青62校網: { 'zh-TW': '葵青62校網', 'zh-CN': '葵青62校网', en: 'Kwai Tsing (NET 62)' },
  荃灣62校網: { 'zh-TW': '荃灣62校網', 'zh-CN': '荃湾62校网', en: 'Tsuen Wan (NET 62)' },
  屯門70校網: { 'zh-TW': '屯門70校網', 'zh-CN': '屯门70校网', en: 'Tuen Mun (NET 70)' },
  屯門71校網: { 'zh-TW': '屯門71校網', 'zh-CN': '屯门71校网', en: 'Tuen Mun (NET 71)' },
  元朗72校網: { 'zh-TW': '元朗72校網', 'zh-CN': '元朗72校网', en: 'Yuen Long (NET 72)' },
  元朗73校網: { 'zh-TW': '元朗73校網', 'zh-CN': '元朗73校网', en: 'Yuen Long (NET 73)' },
  元朗74校網: { 'zh-TW': '元朗74校網', 'zh-CN': '元朗74校网', en: 'Yuen Long (NET 74)' },
  北區80校網: { 'zh-TW': '北區80校網', 'zh-CN': '北区80校网', en: 'North (NET 80)' },
  北區81校網: { 'zh-TW': '北區81校網', 'zh-CN': '北区81校网', en: 'North (NET 81)' },
  北區83校網: { 'zh-TW': '北區83校網', 'zh-CN': '北区83校网', en: 'North (NET 83)' },
  大埔84校網: { 'zh-TW': '大埔84校網', 'zh-CN': '大埔84校网', en: 'Tai Po (NET 84)' },
  大埔89校網: { 'zh-TW': '大埔89校網', 'zh-CN': '大埔89校网', en: 'Tai Po (NET 89)' },
  沙田88校網: { 'zh-TW': '沙田88校網', 'zh-CN': '沙田88校网', en: 'Sha Tin (NET 88)' },
  沙田91校網: { 'zh-TW': '沙田91校網', 'zh-CN': '沙田91校网', en: 'Sha Tin (NET 91)' },
  西貢95校網: { 'zh-TW': '西貢95校網', 'zh-CN': '西贡95校网', en: 'Sai Kung (NET 95)' },
  離島98校網: { 'zh-TW': '離島98校網', 'zh-CN': '离岛98校网', en: 'Islands (NET 98)' },
  離島99校網: { 'zh-TW': '離島99校網', 'zh-CN': '离岛99校网', en: 'Islands (NET 99)' },
};

export function getSchoolNetLabel(net: string, locale: AppLocale): string {
  return SCHOOL_NET_LABELS[net]?.[locale] ?? net;
}
