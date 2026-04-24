export type InfoPageId = 'about' | 'contact' | 'terms' | 'privacy';

export const INFO_PAGES: Record<
  InfoPageId,
  { title: string; paragraphs: string[] }
> = {
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
      'hello@thouse.example',
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

export const FOOTER_LINK_TO_ID: { label: string; id: InfoPageId }[] = [
  { label: '關於我們', id: 'about' },
  { label: '聯絡我們', id: 'contact' },
  { label: '用戶守則及服務條款', id: 'terms' },
  { label: '私隱政策', id: 'privacy' },
];
