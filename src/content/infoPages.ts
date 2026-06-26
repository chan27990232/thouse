import type { AppLocale } from '../../lib/locale';

export type InfoPageId = 'about' | 'contact' | 'terms' | 'privacy';

export type InfoPageContent = { title: string; paragraphs: string[] };

const infoPagesZhTW: Record<InfoPageId, InfoPageContent> = {
  about: {
    title: '關於我們',
    paragraphs: [
      '簡屋（THOUSE）為香港租屋配對平台，協助租客與業主更有效率地發布與瀏覽租盤資訊。',
      '我們重視交易透明與使用者體驗，持續優化搜尋、溝通與實名審核相關功能。若您有任何建議，歡迎透過「聯絡我們」與我們聯繫。',
    ],
  },
  contact: {
    title: '聯絡我們',
    paragraphs: [
      '如有查詢、合作或技術支援，請電郵至：',
      'thouseltdinfo@gmail.com',
      '服務時間：星期一至五 10:00–18:00（公眾假期除外）。',
    ],
  },
  terms: {
    title: '用戶守則及服務條款',
    paragraphs: [
      '使用本服務即表示您同意遵守平台規則，包括提供真實資訊、尊重其他用戶，以及不利用本服務從事違法或侵權行為。',
      '租務條件、按金、租約內容等法律關係由租客與業主自行協商；本平台僅提供資訊媒合，不構成地產代理或法律意見。完整條款以日後上載之正式版本為準，請勿以此草稿作法律依據。',
    ],
  },
  privacy: {
    title: '私隱政策',
    paragraphs: [
      '我們可能收集您於註冊、使用服務及客戶支援時提供的資料（例如聯絡方式、帳戶識別資訊），以提供、維持及改善服務。',
      '我們不會在無合法依據下出售您的個人資料。Cookie 及第三方服務之使用，將在正式版本另行說明。使用本服務即表示您知悉本政策之內容（本頁為概要說明，正式文本以上線版本為準）。',
    ],
  },
};

const infoPagesZhCN: Record<InfoPageId, InfoPageContent> = {
  about: {
    title: '关于我们',
    paragraphs: [
      '简屋（THOUSE）为香港租屋配对平台，协助租客与业主更有效率地发布与浏览租盘信息。',
      '我们重视交易透明与用户体验，持续优化搜索、沟通与实名审核相关功能。若您有任何建议，欢迎通过「联系我们」与我们联系。',
    ],
  },
  contact: {
    title: '联系我们',
    paragraphs: [
      '如有查询、合作或技术支持，请电邮至：',
      'thouseltdinfo@gmail.com',
      '服务时间：星期一至五 10:00–18:00（公众假期除外）。',
    ],
  },
  terms: {
    title: '用户守则及服务条款',
    paragraphs: [
      '使用本服务即表示您同意遵守平台规则，包括提供真实信息、尊重其他用户，以及不利用本服务从事违法或侵权行为。',
      '租务条件、按金、租约内容等法律关系由租客与业主自行协商；本平台仅提供信息媒合，不构成地产代理或法律意见。完整条款以日后上传之正式版本为准，请勿以此草稿作法律依据。',
    ],
  },
  privacy: {
    title: '隐私政策',
    paragraphs: [
      '我们可能收集您于注册、使用服务及客户支援时提供的资料（例如联系方式、账户识别信息），以提供、维持及改善服务。',
      '我们不会在无合法依据下出售您的个人资料。Cookie 及第三方服务之使用，将在正式版本另行说明。使用本服务即表示您知悉本政策之内容（本页为概要说明，正式文本以上线版本为准）。',
    ],
  },
};

const infoPagesEn: Record<InfoPageId, InfoPageContent> = {
  about: {
    title: 'About us',
    paragraphs: [
      'Thouse is a Hong Kong rental matching platform helping tenants and landlords publish and browse listings more efficiently.',
      'We focus on transparency and user experience, and keep improving search, messaging, and identity verification. For feedback, please use Contact us.',
    ],
  },
  contact: {
    title: 'Contact us',
    paragraphs: [
      'For enquiries, partnerships, or technical support, email:',
      'thouseltdinfo@gmail.com',
      'Hours: Mon–Fri 10:00–18:00 (except public holidays).',
    ],
  },
  terms: {
    title: 'Terms of service',
    paragraphs: [
      'By using this service you agree to platform rules: provide accurate information, respect other users, and do not use the service unlawfully.',
      'Lease terms, deposits, and legal relationships are between tenant and landlord. This platform provides matching only and is not legal or agency advice. The full terms will be published separately; this page is a summary draft.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    paragraphs: [
      'We may collect information you provide when registering, using the service, or contacting support (e.g. contact details, account identifiers) to operate and improve the service.',
      'We do not sell personal data without lawful basis. Cookie and third-party use will be described in the formal policy. By using the service you acknowledge this summary; the published version prevails.',
    ],
  },
};

export const INFO_PAGES_BY_LOCALE: Record<AppLocale, Record<InfoPageId, InfoPageContent>> = {
  'zh-TW': infoPagesZhTW,
  'zh-CN': infoPagesZhCN,
  en: infoPagesEn,
};

/** @deprecated Use getInfoPages(locale) */
export const INFO_PAGES = infoPagesZhTW;

export function getInfoPages(locale: AppLocale): Record<InfoPageId, InfoPageContent> {
  return INFO_PAGES_BY_LOCALE[locale];
}

export function getFooterLinks(locale: AppLocale): { label: string; id: InfoPageId }[] {
  const pages = getInfoPages(locale);
  return (['about', 'contact', 'terms', 'privacy'] as const).map((id) => ({
    id,
    label: pages[id].title,
  }));
}

/** @deprecated Use getFooterLinks(locale) */
export const FOOTER_LINK_TO_ID: { label: string; id: InfoPageId }[] = [
  { label: '關於我們', id: 'about' },
  { label: '聯絡我們', id: 'contact' },
  { label: '用戶守則及服務條款', id: 'terms' },
  { label: '私隱政策', id: 'privacy' },
];
