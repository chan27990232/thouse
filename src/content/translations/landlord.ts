import type { AppLocale } from '../../lib/locale';

const landlordZhTW = {
  brandName: '簡屋',
  subtitle: '業主管理',
  overview: '總覽',
  myProperties: '我的放盤',
  applications: '租務申請',
  wallet: '錢包',
  notice: '通知',
  chat: '聊天',
  profile: '個人資料',
} as const;

export type LandlordMessages = typeof landlordZhTW;

const landlordZhCN: LandlordMessages = {
  brandName: '简屋',
  subtitle: '业主管理',
  overview: '总览',
  myProperties: '我的放盘',
  applications: '租务申请',
  wallet: '钱包',
  notice: '通知',
  chat: '聊天',
  profile: '个人资料',
};

const landlordEn: LandlordMessages = {
  brandName: 'Thouse',
  subtitle: 'Landlord portal',
  overview: 'Overview',
  myProperties: 'My listings',
  applications: 'Applications',
  wallet: 'Wallet',
  notice: 'Notifications',
  chat: 'Chat',
  profile: 'Profile',
};

export const landlordMessages: Record<AppLocale, LandlordMessages> = {
  'zh-TW': landlordZhTW,
  'zh-CN': landlordZhCN,
  en: landlordEn,
};
