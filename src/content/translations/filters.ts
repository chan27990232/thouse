import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';

const filtersZhTW = {
  description: '進階條件會與上方地區、租金、房間數一併套用。',
  tubeSchoolSection: '地鐵線／校網',
  byMtr: '按地鐵線',
  bySchoolNet: '按校網',
  selectMtrLine: '選擇地鐵線',
  selectStation: '選擇車站（{line}）',
  selectSchoolNet: '選擇校網',
  tubeSchoolHint: '可選：以地鐵站或校網搜尋（與左側「地區」擇一使用）。',
  areaSection: '實用面積（平方呎）',
  areaMin: '最少',
  areaMax: '最多',
  areaMinAria: '最少實用面積',
  areaMaxAria: '最多實用面積',
  areaMinLabel: '0 呎',
  areaMaxLabel: '{max}+ 呎',
  floorSection: '樓層（可多選）',
  floorLow: '低層 (1–5)',
  floorMid: '中層 (6–15)',
  floorHigh: '高層 (16+)',
  ageSection: '樓齡（可多選）',
  buildingFacilities: '大廈設施',
  reset: '重設',
  apply: '套用篩選',
  searchCriteria: '搜尋條件',
  extraFilters: '+{count} 項篩選',
  priceUnlimited: '不限',
} as const;

export type FiltersMessages = typeof filtersZhTW;

const filtersZhCN: FiltersMessages = {
  description: '进阶条件会与上方地区、租金、房间数一并套用。',
  tubeSchoolSection: '地铁线／校网',
  byMtr: '按地铁线',
  bySchoolNet: '按校网',
  selectMtrLine: '选择地铁线',
  selectStation: '选择车站（{line}）',
  selectSchoolNet: '选择校网',
  tubeSchoolHint: '可选：以地铁站或校网搜索（与左侧「地区」择一使用）。',
  areaSection: '实用面积（平方呎）',
  areaMin: '最少',
  areaMax: '最多',
  areaMinAria: '最少实用面积',
  areaMaxAria: '最多实用面积',
  areaMinLabel: '0 呎',
  areaMaxLabel: '{max}+ 呎',
  floorSection: '楼层（可多选）',
  floorLow: '低层 (1–5)',
  floorMid: '中层 (6–15)',
  floorHigh: '高层 (16+)',
  ageSection: '楼龄（可多选）',
  buildingFacilities: '大厦设施',
  reset: '重设',
  apply: '套用筛选',
  searchCriteria: '搜索条件',
  extraFilters: '+{count} 项筛选',
  priceUnlimited: '不限',
};

const filtersEn: FiltersMessages = {
  description: 'Advanced filters apply together with district, rent and bedrooms above.',
  tubeSchoolSection: 'MTR / school net',
  byMtr: 'By MTR line',
  bySchoolNet: 'By school net',
  selectMtrLine: 'Select MTR line',
  selectStation: 'Select station ({line})',
  selectSchoolNet: 'Select school net',
  tubeSchoolHint: 'Optional: search by MTR station or school net (instead of district on the left).',
  areaSection: 'Saleable area (sq ft)',
  areaMin: 'Min',
  areaMax: 'Max',
  areaMinAria: 'Minimum saleable area',
  areaMaxAria: 'Maximum saleable area',
  areaMinLabel: '0 sq ft',
  areaMaxLabel: '{max}+ sq ft',
  floorSection: 'Floor (multi-select)',
  floorLow: 'Low (1–5)',
  floorMid: 'Mid (6–15)',
  floorHigh: 'High (16+)',
  ageSection: 'Building age (multi-select)',
  buildingFacilities: 'Building facilities',
  reset: 'Reset',
  apply: 'Apply filters',
  searchCriteria: 'Search criteria',
  extraFilters: '+{count} filters',
  priceUnlimited: 'Any',
};

export const filtersMessages: Record<AppLocale, FiltersMessages> = {
  'zh-TW': filtersZhTW,
  'zh-CN': filtersZhCN,
  en: filtersEn,
};

/** canonical 繁中設施名 → 各語顯示 */
export const AMENITY_LABELS: Record<string, Record<AppLocale, string>> = {
  升降機: { 'zh-TW': '升降機', 'zh-CN': '升降机', en: 'Lift' },
  停車場: { 'zh-TW': '停車場', 'zh-CN': '停车场', en: 'Parking' },
  健身房: { 'zh-TW': '健身房', 'zh-CN': '健身房', en: 'Gym' },
  游泳池: { 'zh-TW': '游泳池', 'zh-CN': '游泳池', en: 'Swimming pool' },
  會所: { 'zh-TW': '會所', 'zh-CN': '会所', en: 'Clubhouse' },
  花園: { 'zh-TW': '花園', 'zh-CN': '花园', en: 'Garden' },
  兒童遊樂場: { 'zh-TW': '兒童遊樂場', 'zh-CN': '儿童游乐场', en: 'Playground' },
  乒乓球場: { 'zh-TW': '乒乓球場', 'zh-CN': '乒乓球场', en: 'Table tennis' },
  網球場: { 'zh-TW': '網球場', 'zh-CN': '网球场', en: 'Tennis court' },
  桑拿浴室: { 'zh-TW': '桑拿浴室', 'zh-CN': '桑拿浴室', en: 'Sauna' },
  緩跑徑: { 'zh-TW': '緩跑徑', 'zh-CN': '缓跑径', en: 'Jogging trail' },
  籃球場: { 'zh-TW': '籃球場', 'zh-CN': '篮球场', en: 'Basketball court' },
  瑜伽室: { 'zh-TW': '瑜伽室', 'zh-CN': '瑜伽室', en: 'Yoga room' },
  圖書館: { 'zh-TW': '圖書館', 'zh-CN': '图书馆', en: 'Library' },
  燒烤區: { 'zh-TW': '燒烤區', 'zh-CN': '烧烤区', en: 'BBQ area' },
  '24小時保安': { 'zh-TW': '24小時保安', 'zh-CN': '24小时保安', en: '24-hour security' },
};

export function getAmenityLabel(name: string, locale: AppLocale): string {
  return AMENITY_LABELS[name]?.[locale] ?? name;
}

export function buildFiltersT(locale: AppLocale) {
  const messages = filtersMessages[locale];
  return {
    ...messages,
    format(key: keyof FiltersMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
    amenity(name: string) {
      return getAmenityLabel(name, locale);
    },
  };
}
