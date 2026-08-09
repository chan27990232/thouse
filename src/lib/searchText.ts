import { PHRASE_LABELS } from './localizePropertyText';
import { DISTRICT_LABELS, HK_DISTRICTS } from './hkDistricts';
import { HK_MTR_LINES, getMtrLineLabel, getMtrStationLabel } from './hkMtr';

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

function normalizeAliasKey(input: string): string {
  return input.toLowerCase().normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function compactAliasKey(input: string): string {
  return normalizeAliasKey(input).replace(/[\s\-_'.,/()+&]/g, '');
}

function addSearchAlias(index: Map<string, Set<string>>, alias: string, ...canonicals: string[]) {
  const keys = new Set<string>();
  const normalizedAlias = normalizeAliasKey(alias);
  const compact = compactAliasKey(alias);
  if (normalizedAlias.length >= 2) keys.add(normalizedAlias);
  if (compact.length >= 2) keys.add(compact);

  const values = new Set<string>();
  for (const canonical of canonicals) {
    const c = canonical.trim();
    if (!c) continue;
    values.add(normalizeSearchText(c));
    values.add(c);
    if (c.endsWith('區')) {
      values.add(normalizeSearchText(c.replace(/區$/, '')));
    }
  }
  if (values.size === 0) return;

  for (const key of keys) {
    if (!index.has(key)) index.set(key, new Set());
    for (const v of values) index.get(key)!.add(v);
  }
}

function buildSearchAliasIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const [zh, labels] of Object.entries(PHRASE_LABELS)) {
    addSearchAlias(index, zh, zh);
    addSearchAlias(index, labels.en, zh);
    addSearchAlias(index, labels['zh-CN'], zh);
  }

  for (const district of HK_DISTRICTS) {
    const labels = DISTRICT_LABELS[district];
    if (!labels) continue;
    const core = district.replace(/區$/, '');
    addSearchAlias(index, labels.en, district, core);
    addSearchAlias(index, labels['zh-CN'], district, core);
    addSearchAlias(index, district, district, core);
  }

  for (const [line, stations] of Object.entries(HK_MTR_LINES)) {
    addSearchAlias(index, line, line);
    addSearchAlias(index, getMtrLineLabel(line, 'en'), line);
    for (const station of stations) {
      addSearchAlias(index, station, station);
      addSearchAlias(index, getMtrStationLabel(station, 'en'), station);
    }
  }


  addSearchAlias(index, 'mongkok', '旺角');
  addSearchAlias(index, 'mk', '旺角');
  addSearchAlias(index, 'tst', '尖沙咀');
  addSearchAlias(index, 'cwb', '銅鑼灣');
  addSearchAlias(index, 'kowloon bay', '九龍灣');
  addSearchAlias(index, 'kowloon', '九龍');
  addSearchAlias(index, 'hk island', '港島');
  addSearchAlias(index, 'hong kong island', '港島');
  addSearchAlias(index, 'studio', '工作室');
  addSearchAlias(index, 'serviced apartment', '服務式');
  addSearchAlias(index, 'subdivided', '劏房');

  return index;
}

const SEARCH_ALIAS_INDEX = buildSearchAliasIndex();

/** 形近／音近常見錯字（租屋搜尋） */
const SIMILAR_CHAR_GROUPS = [
  ['王', '旺'],
  ['灣', '彎', '弯'],
  ['黃', '黄'],
  ['龍', '龙'],
  ['島', '岛'],
  ['東', '东'],
  ['門', '门'],
  ['觀', '观'],
  ['埗', '布', '埔'],
  ['鑼', '罗', '锣'],
  ['魚', '鱼'],
  ['環', '环'],
  ['紅', '红'],
  ['馬', '马'],
  ['烏', '乌'],
  ['樂', '乐'],
  ['車', '车'],
  ['圍', '围'],
  ['啟', '启'],
  ['恆', '恒'],
  ['將', '将'],
  ['軍', '军'],
  ['長', '长'],
  ['廈', '厦'],
  ['廟', '庙'],
  ['鐘', '钟'],
  ['裡', '里', '裏'],
  ['鑽', '钻'],
  ['藍', '蓝'],
  ['頭', '头'],
  ['興', '兴'],
  ['灣', '湾'],
  ['咀', '嘴'],
  ['硤', '硖'],
  ['窩', '窝'],
  ['嶺', '岭'],
  ['頌', '颂'],
  ['廣', '广'],
  ['場', '场'],
  ['園', '园'],
  ['層', '层'],
  ['樓', '楼'],
  ['衛', '卫'],
  ['間', '间'],
  ['廳', '厅'],
  ['廚', '厨'],
  ['陽', '阳'],
  ['風', '风'],
  ['氣', '气'],
  ['電', '电'],
  ['話', '话'],
  ['網', '网'],
  ['線', '线'],
  ['鐵', '铁'],
  ['軌', '轨'],
  ['崗', '岗'],
  ['舖', '铺'],
  ['舊', '旧'],
  ['倉', '仓'],
  ['棟', '栋'],
  ['齋', '斋'],
  ['營', '营'],
  ['盤', '盘'],
  ['鰂', '鲗'],
  ['離', '离'],
  ['區', '区'],
  ['設', '设'],
  ['備', '备'],
  ['獨', '独'],
  ['臥', '卧'],
  ['開', '开'],
  ['務', '务'],
  ['絡', '络'],
  ['銅', '铜'],
  ['筲', '筲'],
  ['灣', '湾'],
  ['葵', '葵'],
  ['茘', '荔'],
];

const SIMILAR_CHAR_MAP = new Map<string, Set<string>>();
for (const group of SIMILAR_CHAR_GROUPS) {
  for (const ch of group) {
    if (!SIMILAR_CHAR_MAP.has(ch)) SIMILAR_CHAR_MAP.set(ch, new Set());
    for (const other of group) SIMILAR_CHAR_MAP.get(ch)!.add(other);
  }
}

function charsAreSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  return SIMILAR_CHAR_MAP.get(a)?.has(b) ?? false;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length]!;
}

function maxFuzzyEditDistance(length: number): number {
  if (length <= 3) return 1;
  if (length <= 6) return 2;
  return 3;
}

function isLatinSearchText(text: string): boolean {
  return /^[a-z0-9\s\-_'.,/()+&]+$/.test(text);
}

function fuzzyLatinMatches(query: string, candidate: string): boolean {
  const q = compactAliasKey(query);
  const c = compactAliasKey(candidate);
  if (q.length < 3 || c.length < 3) return false;
  if (Math.abs(q.length - c.length) > maxFuzzyEditDistance(q.length)) return false;
  return levenshteinDistance(q, c) <= maxFuzzyEditDistance(q.length);
}

function fuzzyChineseMatches(query: string, candidate: string): boolean {
  const q = [...normalizeSearchText(query)];
  const c = [...normalizeSearchText(candidate)];
  if (q.length < 2 || c.length < 2) return false;

  const maxDist = maxFuzzyEditDistance(q.length);
  if (Math.abs(q.length - c.length) > maxDist) return false;

  if (q.length === c.length) {
    let diffs = 0;
    for (let i = 0; i < q.length; i++) {
      if (q[i] === c[i]) continue;
      diffs++;
      if (diffs > maxDist) return false;
      if (!charsAreSimilar(q[i]!, c[i]!)) return false;
    }
    return diffs > 0 && diffs <= maxDist;
  }

  return levenshteinDistance(q.join(''), c.join('')) <= maxDist;
}

function buildFuzzyCanonicalTerms(): string[] {
  const terms = new Set<string>();

  for (const district of HK_DISTRICTS) {
    terms.add(district);
    terms.add(district.replace(/區$/, ''));
  }

  for (const stations of Object.values(HK_MTR_LINES)) {
    for (const station of stations) terms.add(station);
  }

  for (const zh of Object.keys(PHRASE_LABELS)) {
    if (zh.length >= 2) terms.add(zh);
  }

  for (const mapped of SEARCH_ALIAS_INDEX.values()) {
    for (const term of mapped) {
      if (term.length >= 2) terms.add(term);
    }
  }

  return [...terms];
}

const FUZZY_CANONICAL_TERMS = buildFuzzyCanonicalTerms();

function generateTypoVariants(text: string, maxDepth = 2): string[] {
  const variants = new Set<string>([text]);
  let frontier = [text];

  for (let depth = 0; depth < maxDepth; depth++) {
    const next: string[] = [];
    for (const current of frontier) {
      const chars = [...current];
      for (let i = 0; i < chars.length; i++) {
        const similars = SIMILAR_CHAR_MAP.get(chars[i]!);
        if (!similars) continue;
        for (const alt of similars) {
          if (alt === chars[i]) continue;
          const variant = chars.slice();
          variant[i] = alt;
          const joined = variant.join('');
          if (!variants.has(joined)) {
            variants.add(joined);
            next.push(joined);
          }
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return [...variants];
}

function addCanonicalSearchTerms(terms: Set<string>, canonical: string) {
  const trimmed = canonical.trim();
  if (!trimmed) return;

  terms.add(trimmed);
  terms.add(normalizeSearchText(trimmed));

  const mapped =
    SEARCH_ALIAS_INDEX.get(normalizeAliasKey(trimmed)) ??
    SEARCH_ALIAS_INDEX.get(compactAliasKey(trimmed));
  if (mapped) {
    for (const term of mapped) terms.add(term);
  }
}

function findFuzzyCanonicalMatches(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (normalized.length < 2) return [];

  const matches = new Set<string>();

  for (const variant of generateTypoVariants(normalized)) {
    const mapped =
      SEARCH_ALIAS_INDEX.get(normalizeAliasKey(variant)) ??
      SEARCH_ALIAS_INDEX.get(compactAliasKey(variant));
    if (mapped) {
      for (const term of mapped) matches.add(term);
    }
  }

  for (const candidate of FUZZY_CANONICAL_TERMS) {
    const latinQuery = isLatinSearchText(normalizeAliasKey(query));
    const latinCandidate = isLatinSearchText(normalizeAliasKey(candidate));
    const matched =
      latinQuery && latinCandidate
        ? fuzzyLatinMatches(query, candidate)
        : !latinQuery && !latinCandidate && fuzzyChineseMatches(query, candidate);

    if (matched) matches.add(candidate);
  }

  return [...matches];
}

function expandSearchTerms(query: string): string[] {
  const terms = new Set<string>();
  const normalized = normalizeSearchText(query);
  if (normalized) terms.add(normalized);

  const raw = query.toLowerCase().trim();
  if (raw) terms.add(raw);

  const lookupKeys = new Set<string>([
    normalizeAliasKey(query),
    compactAliasKey(query),
    ...normalizeAliasKey(query).split(/\s+/).filter((w) => w.length >= 2),
  ]);

  for (const key of lookupKeys) {
    const mapped = SEARCH_ALIAS_INDEX.get(key);
    if (mapped) {
      for (const term of mapped) terms.add(term);
    }
  }

  const fuzzyParts = new Set<string>([
    query,
    normalized,
    ...normalizeAliasKey(query).split(/\s+/).filter((w) => w.length >= 2),
  ]);

  for (const part of fuzzyParts) {
    for (const canonical of findFuzzyCanonicalMatches(part)) {
      addCanonicalSearchTerms(terms, canonical);
    }
  }

  return [...terms].filter((t) => t.length > 0);
}

/** 標題／描述是否匹配搜尋（支援繁、簡、英文互搜） */
export function textMatchesQuery(text: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  const normalizedHaystack = normalizeSearchText(text);
  const rawHaystack = text.toLowerCase();

  for (const term of expandSearchTerms(q)) {
    if (normalizedHaystack.includes(term)) return true;
    if (rawHaystack.includes(term)) return true;
  }

  return false;
}

/** 比對放盤標題與地區欄位（關鍵字搜尋用；含錯字容錯） */
export function propertyMatchesSearchQuery(
  property: { title: string; district?: string | null },
  query: string,
): boolean {
  if (!query.trim()) return true;
  if (textMatchesQuery(property.title, query)) return true;
  if (property.district && textMatchesQuery(property.district, query)) return true;

  const district = (property.district ?? '').trim();
  if (district) {
    const labels = DISTRICT_LABELS[district];
    if (labels) {
      if (textMatchesQuery(labels.en, query)) return true;
      if (textMatchesQuery(labels['zh-CN'], query)) return true;
    }
  }

  return false;
}
