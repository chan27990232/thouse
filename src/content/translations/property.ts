import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';

const propertyZhTW = {
  hongKong: '香港',
  floor: '樓層',
  descriptionTitle: '物業描述',
  descriptionBody:
    '此劏房位置優越，設備齊全，適合個人或小家庭居住。鄰近公共交通設施、購物中心及餐廳，生活便利。',
  amenitiesTitle: '設施',
  amenityAc: '冷氣',
  amenityHeating: '暖氣',
  amenityWifi: 'WiFi',
  amenityParking: '停車場',
  amenityLift: '升降機',
  amenitySecurity: '保安',
  contactLandlord: '聯絡業主',
  signNow: '立即簽約',
  missingLandlordError: '此物業缺少業主資料，無法通知業主。請重新從列表進入。',
} as const;

export type PropertyMessages = typeof propertyZhTW;

const propertyZhCN: PropertyMessages = {
  hongKong: '香港',
  floor: '楼层',
  descriptionTitle: '物业描述',
  descriptionBody:
    '此劏房位置优越，设备齐全，适合个人或小家庭居住。邻近公共交通设施、购物中心及餐厅，生活便利。',
  amenitiesTitle: '设施',
  amenityAc: '冷气',
  amenityHeating: '暖气',
  amenityWifi: 'WiFi',
  amenityParking: '停车场',
  amenityLift: '升降机',
  amenitySecurity: '保安',
  contactLandlord: '联络业主',
  signNow: '立即签约',
  missingLandlordError: '此物业缺少业主资料，无法通知业主。请重新从列表进入。',
};

const propertyEn: PropertyMessages = {
  hongKong: 'Hong Kong',
  floor: 'Floor',
  descriptionTitle: 'Description',
  descriptionBody:
    'Well-located subdivided unit with essential fittings, suitable for individuals or small households. Close to public transport, shopping and dining.',
  amenitiesTitle: 'Amenities',
  amenityAc: 'Air Conditioning',
  amenityHeating: 'Heating',
  amenityWifi: 'WiFi',
  amenityParking: 'Parking',
  amenityLift: 'Lift',
  amenitySecurity: 'Security',
  contactLandlord: 'Contact Landlord',
  signNow: 'Apply Now',
  missingLandlordError: 'Landlord information is missing. Please open this listing again from the list.',
};

export const propertyMessages: Record<AppLocale, PropertyMessages> = {
  'zh-TW': propertyZhTW,
  'zh-CN': propertyZhCN,
  en: propertyEn,
};

export const PROPERTY_AMENITY_KEYS = [
  'amenityAc',
  'amenityHeating',
  'amenityWifi',
  'amenityParking',
  'amenityLift',
  'amenitySecurity',
] as const;

export function buildPropertyT(locale: AppLocale) {
  const messages = propertyMessages[locale];
  return {
    ...messages,
    format(key: keyof PropertyMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
  };
}
