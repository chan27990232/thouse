/** 簡體詞組 → 繁體（香港租屋搜尋常見） */
const SC_PHRASES: [string, string][] = [
  ['九龙城', '九龍城'],
  ['油尖旺', '油尖旺'],
  ['黄大仙', '黃大仙'],
  ['观塘', '觀塘'],
  ['深水埗', '深水埗'],
  ['鲗鱼涌', '鰂魚涌'],
  ['铜锣湾', '銅鑼灣'],
  ['筲箕湾', '筲箕灣'],
  ['湾仔', '灣仔'],
  ['荃湾', '荃灣'],
  ['屯门', '屯門'],
  ['元朗', '元朗'],
  ['大埔', '大埔'],
  ['沙田', '沙田'],
  ['西贡', '西貢'],
  ['离岛', '離島'],
  ['北区', '北區'],
  ['葵青', '葵青'],
  ['校网', '校網'],
  ['地铁', '地鐵'],
  ['服务式', '服務式'],
  ['工作室', '工作室'],
  ['开放式', '開放式'],
  ['独立', '獨立'],
  ['卫生间', '衛生間'],
  ['洗手间', '洗手間'],
];

/** 簡體單字 → 繁體 */
const SC_CHARS: Record<string, string> = {
  东: '東',
  门: '門',
  车: '車',
  湾: '灣',
  岛: '島',
  铜: '銅',
  锣: '鑼',
  馆: '館',
  场: '場',
  园: '園',
  层: '層',
  楼: '樓',
  厕: '廁',
  卫: '衛',
  间: '間',
  厅: '廳',
  厨: '廚',
  阳: '陽',
  风: '風',
  气: '氣',
  电: '電',
  话: '話',
  网: '網',
  线: '線',
  铁: '鐵',
  轨: '軌',
  广: '廣',
  龙: '龍',
  岗: '崗',
  黄: '黃',
  钟: '鐘',
  铺: '舖',
  围: '圍',
  乐: '樂',
  旧: '舊',
  仓: '倉',
  厦: '廈',
  栋: '棟',
  斋: '齋',
  观: '觀',
  窝: '窩',
  兴: '興',
  执: '執',
  环: '環',
  营: '營',
  盘: '盤',
  鲗: '鰂',
  鱼: '魚',
  离: '離',
  区: '區',
  设: '設',
  备: '備',
  独: '獨',
  卧: '臥',
  开: '開',
  务: '務',
  络: '絡',
};

function convertScToTc(text: string): string {
  let out = text;
  for (const [sc, tc] of SC_PHRASES) {
    out = out.split(sc).join(tc);
  }
  return [...out].map((ch) => SC_CHARS[ch] ?? ch).join('');
}

/** 將搜尋文字正規化（繁簡互通、英文小寫） */
export function normalizeSearchText(input: string): string {
  return convertScToTc(input.toLowerCase().normalize('NFKC').trim());
}

/** 標題／描述是否匹配搜尋（支援繁、簡、英文） */
export function textMatchesQuery(text: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  const normalizedHaystack = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(q);
  if (normalizedHaystack.includes(normalizedQuery)) return true;

  return text.toLowerCase().includes(q.toLowerCase());
}
