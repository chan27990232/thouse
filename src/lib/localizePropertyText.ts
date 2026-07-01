import type { AppLocale } from './locale';
import { getDistrictLabel } from './hkDistricts';

type LabelTriple = Record<AppLocale, string>;

/** Canonical 繁中片語 → 各語顯示（較長片語須優先匹配） */
const PHRASE_LABELS: Record<string, LabelTriple> = {
  // — 物業類型（放盤標題常見尾綴）
  劏房: { 'zh-TW': '劏房', 'zh-CN': '劏房', en: 'Subdivided unit' },
  分間單位: { 'zh-TW': '分間單位', 'zh-CN': '分间单位', en: 'Subdivided unit' },
  唐樓: { 'zh-TW': '唐樓', 'zh-CN': '唐楼', en: 'Tenement' },
  獨立屋: { 'zh-TW': '獨立屋', 'zh-CN': '独立屋', en: 'Detached house' },
  村屋: { 'zh-TW': '村屋', 'zh-CN': '村屋', en: 'Village house' },
  工作室: { 'zh-TW': '工作室', 'zh-CN': '工作室', en: 'Studio' },
  開放式: { 'zh-TW': '開放式', 'zh-CN': '开放式', en: 'Open plan' },

  // — 常見屋苑／大廈（放盤 placeholder 及真實樓盤）
  太古城: { 'zh-TW': '太古城', 'zh-CN': '太古城', en: 'Taikoo Shing' },
  海濱花園: { 'zh-TW': '海濱花園', 'zh-CN': '海滨花园', en: 'Riviera Gardens' },
  雅賓利大廈: { 'zh-TW': '雅賓利大廈', 'zh-CN': '雅宾利大厦', en: 'The Albany' },
  雅賓大廈: { 'zh-TW': '雅賓大廈', 'zh-CN': '雅宾大厦', en: 'Yap Ban Building' },
  豪華公寓: { 'zh-TW': '豪華公寓', 'zh-CN': '豪华公寓', en: 'Luxury Apartments' },

  // — 建築／描述用語
  豪華: { 'zh-TW': '豪華', 'zh-CN': '豪华', en: 'Luxury' },
  海景: { 'zh-TW': '海景', 'zh-CN': '海景', en: 'Sea view' },
  山景: { 'zh-TW': '山景', 'zh-CN': '山景', en: 'Mountain view' },
  新裝修: { 'zh-TW': '新裝修', 'zh-CN': '新装修', en: 'Newly renovated' },
  近地鐵: { 'zh-TW': '近地鐵', 'zh-CN': '近地铁', en: 'Near MTR' },
  傢俬電器齊全: { 'zh-TW': '傢俬電器齊全', 'zh-CN': '家具电器齐全', en: 'Furnished with appliances' },
  獨立廁所: { 'zh-TW': '獨立廁所', 'zh-CN': '独立厕所', en: 'Private toilet' },
  可煮食: { 'zh-TW': '可煮食', 'zh-CN': '可煮食', en: 'Cooking allowed' },
  可養寵: { 'zh-TW': '可養寵', 'zh-CN': '可养宠', en: 'Pets allowed' },
  連天台: { 'zh-TW': '連天台', 'zh-CN': '连天台', en: 'With rooftop' },
  有升降機: { 'zh-TW': '有升降機', 'zh-CN': '有升降机', en: 'With lift' },
  大廈: { 'zh-TW': '大廈', 'zh-CN': '大厦', en: 'Building' },
  商場: { 'zh-TW': '商場', 'zh-CN': '商场', en: 'Shopping centre' },
  中心: { 'zh-TW': '中心', 'zh-CN': '中心', en: 'Centre' },
  花園: { 'zh-TW': '花園', 'zh-CN': '花园', en: 'Garden' },
  廣場: { 'zh-TW': '廣場', 'zh-CN': '广场', en: 'Plaza' },
  公寓: { 'zh-TW': '公寓', 'zh-CN': '公寓', en: 'Apartments' },
  屋苑: { 'zh-TW': '屋苑', 'zh-CN': '屋苑', en: 'Estate' },
  閣: { 'zh-TW': '閣', 'zh-CN': '阁', en: 'Court' },
  苑: { 'zh-TW': '苑', 'zh-CN': '苑', en: 'Court' },
  座: { 'zh-TW': '座', 'zh-CN': '座', en: 'Tower' },

  // — 描述欄位標籤
  '地區：': { 'zh-TW': '地區：', 'zh-CN': '地区：', en: 'District: ' },
  '類型：': { 'zh-TW': '類型：', 'zh-CN': '类型：', en: 'Type: ' },
  '特色：': { 'zh-TW': '特色：', 'zh-CN': '特色：', en: 'Features: ' },
  '屋苑：': { 'zh-TW': '屋苑：', 'zh-CN': '屋苑：', en: 'Estate: ' },
  '大廈：': { 'zh-TW': '大廈：', 'zh-CN': '大厦：', en: 'Building: ' },

  // — 港鐵站及常見地名（官方／慣用英文）
  旺角東: { 'zh-TW': '旺角東', 'zh-CN': '旺角东', en: 'Mong Kok East' },
  尖東: { 'zh-TW': '尖東', 'zh-CN': '尖东', en: 'East Tsim Sha Tsui' },
  香港大學: { 'zh-TW': '香港大學', 'zh-CN': '香港大学', en: 'HKU' },
  堅尼地城: { 'zh-TW': '堅尼地城', 'zh-CN': '坚尼地城', en: 'Kennedy Town' },
  西營盤: { 'zh-TW': '西營盤', 'zh-CN': '西营盘', en: 'Sai Ying Pun' },
  上環: { 'zh-TW': '上環', 'zh-CN': '上环', en: 'Sheung Wan' },
  中環: { 'zh-TW': '中環', 'zh-CN': '中环', en: 'Central' },
  金鐘: { 'zh-TW': '金鐘', 'zh-CN': '金钟', en: 'Admiralty' },
  灣仔: { 'zh-TW': '灣仔', 'zh-CN': '湾仔', en: 'Wan Chai' },
  銅鑼灣: { 'zh-TW': '銅鑼灣', 'zh-CN': '铜锣湾', en: 'Causeway Bay' },
  天后: { 'zh-TW': '天后', 'zh-CN': '天后', en: 'Tin Hau' },
  炮台山: { 'zh-TW': '炮台山', 'zh-CN': '炮台山', en: 'Fortress Hill' },
  北角: { 'zh-TW': '北角', 'zh-CN': '北角', en: 'North Point' },
  鰂魚涌: { 'zh-TW': '鰂魚涌', 'zh-CN': '鲗鱼涌', en: 'Quarry Bay' },
  太古: { 'zh-TW': '太古', 'zh-CN': '太古', en: 'Tai Koo' },
  西灣河: { 'zh-TW': '西灣河', 'zh-CN': '西湾河', en: 'Sai Wan Ho' },
  筲箕灣: { 'zh-TW': '筲箕灣', 'zh-CN': '筲箕湾', en: 'Shau Kei Wan' },
  杏花邨: { 'zh-TW': '杏花邨', 'zh-CN': '杏花邨', en: 'Heng Fa Chuen' },
  柴灣: { 'zh-TW': '柴灣', 'zh-CN': '柴湾', en: 'Chai Wan' },
  荃灣: { 'zh-TW': '荃灣', 'zh-CN': '荃湾', en: 'Tsuen Wan' },
  荃灣西: { 'zh-TW': '荃灣西', 'zh-CN': '荃湾西', en: 'Tsuen Wan West' },
  大窩口: { 'zh-TW': '大窩口', 'zh-CN': '大窝口', en: 'Tai Wo Hau' },
  葵興: { 'zh-TW': '葵興', 'zh-CN': '葵兴', en: 'Kwai Hing' },
  葵芳: { 'zh-TW': '葵芳', 'zh-CN': '葵芳', en: 'Kwai Fong' },
  茘景: { 'zh-TW': '茘景', 'zh-CN': '荔景', en: 'Lai King' },
  美孚: { 'zh-TW': '美孚', 'zh-CN': '美孚', en: 'Mei Foo' },
  茘枝角: { 'zh-TW': '茘枝角', 'zh-CN': '荔枝角', en: 'Lai Chi Kok' },
  長沙灣: { 'zh-TW': '長沙灣', 'zh-CN': '长沙湾', en: 'Cheung Sha Wan' },
  深水埗: { 'zh-TW': '深水埗', 'zh-CN': '深水埗', en: 'Sham Shui Po' },
  太子: { 'zh-TW': '太子', 'zh-CN': '太子', en: 'Prince Edward' },
  旺角: { 'zh-TW': '旺角', 'zh-CN': '旺角', en: 'Mong Kok' },
  油麻地: { 'zh-TW': '油麻地', 'zh-CN': '油麻地', en: 'Yau Ma Tei' },
  佐敦: { 'zh-TW': '佐敦', 'zh-CN': '佐敦', en: 'Jordan' },
  尖沙咀: { 'zh-TW': '尖沙咀', 'zh-CN': '尖沙咀', en: 'Tsim Sha Tsui' },
  黃埔: { 'zh-TW': '黃埔', 'zh-CN': '黄埔', en: 'Whampoa' },
  何文田: { 'zh-TW': '何文田', 'zh-CN': '何文田', en: 'Ho Man Tin' },
  石硤尾: { 'zh-TW': '石硤尾', 'zh-CN': '石硖尾', en: 'Shek Kip Mei' },
  九龍塘: { 'zh-TW': '九龍塘', 'zh-CN': '九龙塘', en: 'Kowloon Tong' },
  樂富: { 'zh-TW': '樂富', 'zh-CN': '乐富', en: 'Lok Fu' },
  黃大仙: { 'zh-TW': '黃大仙', 'zh-CN': '黄大仙', en: 'Wong Tai Sin' },
  鑽石山: { 'zh-TW': '鑽石山', 'zh-CN': '钻石山', en: 'Diamond Hill' },
  彩虹: { 'zh-TW': '彩虹', 'zh-CN': '彩虹', en: 'Choi Hung' },
  九龍灣: { 'zh-TW': '九龍灣', 'zh-CN': '九龙湾', en: 'Kowloon Bay' },
  牛頭角: { 'zh-TW': '牛頭角', 'zh-CN': '牛头角', en: 'Ngau Tau Kok' },
  觀塘: { 'zh-TW': '觀塘', 'zh-CN': '观塘', en: 'Kwun Tong' },
  藍田: { 'zh-TW': '藍田', 'zh-CN': '蓝田', en: 'Lam Tin' },
  油塘: { 'zh-TW': '油塘', 'zh-CN': '油塘', en: 'Yau Tong' },
  調景嶺: { 'zh-TW': '調景嶺', 'zh-CN': '调景岭', en: 'Tiu Keng Leng' },
  奧運: { 'zh-TW': '奧運', 'zh-CN': '奥运', en: 'Olympic' },
  南昌: { 'zh-TW': '南昌', 'zh-CN': '南昌', en: 'Nam Cheong' },
  柯士甸: { 'zh-TW': '柯士甸', 'zh-CN': '柯士甸', en: 'Austin' },
  紅磡: { 'zh-TW': '紅磡', 'zh-CN': '红磡', en: 'Hung Hom' },
  土瓜灣: { 'zh-TW': '土瓜灣', 'zh-CN': '土瓜湾', en: 'To Kwa Wan' },
  宋皇臺: { 'zh-TW': '宋皇臺', 'zh-CN': '宋皇台', en: 'Sung Wong Toi' },
  啟德: { 'zh-TW': '啟德', 'zh-CN': '启德', en: 'Kai Tak' },
  顯徑: { 'zh-TW': '顯徑', 'zh-CN': '显径', en: 'Hin Keng' },
  大圍: { 'zh-TW': '大圍', 'zh-CN': '大围', en: 'Tai Wai' },
  車公廟: { 'zh-TW': '車公廟', 'zh-CN': '车公庙', en: 'Che Kung Temple' },
  沙田: { 'zh-TW': '沙田', 'zh-CN': '沙田', en: 'Sha Tin' },
  第一城: { 'zh-TW': '第一城', 'zh-CN': '第一城', en: 'City One' },
  石門: { 'zh-TW': '石門', 'zh-CN': '石门', en: 'Shek Mun' },
  大水坑: { 'zh-TW': '大水坑', 'zh-CN': '大水坑', en: 'Tai Shui Hang' },
  恆安: { 'zh-TW': '恆安', 'zh-CN': '恒安', en: 'Heng On' },
  馬鞍山: { 'zh-TW': '馬鞍山', 'zh-CN': '马鞍山', en: 'Ma On Shan' },
  烏溪沙: { 'zh-TW': '烏溪沙', 'zh-CN': '乌溪沙', en: 'Wu Kai Sha' },
  屯門: { 'zh-TW': '屯門', 'zh-CN': '屯门', en: 'Tuen Mun' },
  兆康: { 'zh-TW': '兆康', 'zh-CN': '兆康', en: 'Siu Hong' },
  天水圍: { 'zh-TW': '天水圍', 'zh-CN': '天水围', en: 'Tin Shui Wai' },
  朗屏: { 'zh-TW': '朗屏', 'zh-CN': '朗屏', en: 'Long Ping' },
  元朗: { 'zh-TW': '元朗', 'zh-CN': '元朗', en: 'Yuen Long' },
  錦上路: { 'zh-TW': '錦上路', 'zh-CN': '锦上路', en: 'Kam Sheung Road' },
  青衣: { 'zh-TW': '青衣', 'zh-CN': '青衣', en: 'Tsing Yi' },
  欣澳: { 'zh-TW': '欣澳', 'zh-CN': '欣澳', en: 'Sunny Bay' },
  東涌: { 'zh-TW': '東涌', 'zh-CN': '东涌', en: 'Tung Chung' },
  將軍澳: { 'zh-TW': '將軍澳', 'zh-CN': '将军澳', en: 'Tseung Kwan O' },
  坑口: { 'zh-TW': '坑口', 'zh-CN': '坑口', en: 'Hang Hau' },
  寶琳: { 'zh-TW': '寶琳', 'zh-CN': '宝琳', en: 'Po Lam' },
  康城: { 'zh-TW': '康城', 'zh-CN': '康城', en: 'LOHAS Park' },
  海怡半島: { 'zh-TW': '海怡半島', 'zh-CN': '海怡半岛', en: 'South Horizons' },
  利東: { 'zh-TW': '利東', 'zh-CN': '利东', en: 'Lei Tung' },
  黃竹坑: { 'zh-TW': '黃竹坑', 'zh-CN': '黄竹坑', en: 'Wong Chuk Hang' },
  海洋公園: { 'zh-TW': '海洋公園', 'zh-CN': '海洋公园', en: 'Ocean Park' },
  會展: { 'zh-TW': '會展', 'zh-CN': '会展', en: 'Exhibition Centre' },
  火炭: { 'zh-TW': '火炭', 'zh-CN': '火炭', en: 'Fo Tan' },
  大學: { 'zh-TW': '大學', 'zh-CN': '大学', en: 'University' },
  大埔墟: { 'zh-TW': '大埔墟', 'zh-CN': '大埔墟', en: 'Tai Po Market' },
  太和: { 'zh-TW': '太和', 'zh-CN': '太和', en: 'Tai Wo' },
  粉嶺: { 'zh-TW': '粉嶺', 'zh-CN': '粉岭', en: 'Fanling' },
  上水: { 'zh-TW': '上水', 'zh-CN': '上水', en: 'Sheung Shui' },
  落馬洲: { 'zh-TW': '落馬洲', 'zh-CN': '落马洲', en: 'Lok Ma Chau' },
  羅湖: { 'zh-TW': '羅湖', 'zh-CN': '罗湖', en: 'Lo Wu' },
  九龍: { 'zh-TW': '九龍', 'zh-CN': '九龙', en: 'Kowloon' },
  香港: { 'zh-TW': '香港', 'zh-CN': '香港', en: 'Hong Kong' },
  半山: { 'zh-TW': '半山', 'zh-CN': '半山', en: 'Mid-Levels' },
  赤柱: { 'zh-TW': '赤柱', 'zh-CN': '赤柱', en: 'Stanley' },
  西環: { 'zh-TW': '西環', 'zh-CN': '西环', en: 'Sai Wan' },
  薄扶林: { 'zh-TW': '薄扶林', 'zh-CN': '薄扶林', en: 'Pok Fu Lam' },
};

const SORTED_PHRASES = Object.keys(PHRASE_LABELS).sort((a, b) => b.length - a.length);

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 將物業標題／描述等中文內容轉為當前語言顯示 */
export function localizePropertyText(text: string, locale: AppLocale): string {
  const raw = text.trim();
  if (!raw || locale === 'zh-TW') return text;

  let result = text;
  for (const phrase of SORTED_PHRASES) {
    if (!result.includes(phrase)) continue;
    result = result.split(phrase).join(PHRASE_LABELS[phrase][locale]);
  }
  return normalizeSpaces(result);
}

/** 十八區或標題內常見地名 */
export function localizePropertyDistrict(district: string | null | undefined, locale: AppLocale): string {
  const raw = (district ?? '').trim();
  if (!raw) return '';
  if (locale === 'zh-TW') return raw;

  const fromDistrict = getDistrictLabel(raw, locale);
  if (fromDistrict !== raw) return fromDistrict;

  return localizePropertyText(raw, locale);
}

/** 從標題擷取第一個可辨識地區（用於詳情頁位置） */
export function extractPropertyAreaFromTitle(title: string, locale: AppLocale): string | null {
  const raw = title.trim();
  if (!raw) return null;

  for (const phrase of SORTED_PHRASES) {
    if (!raw.includes(phrase)) continue;
    const label = PHRASE_LABELS[phrase][locale];
    // 略過純建築後綴，優先顯示地區／站名
    if (['Building', 'Centre', 'Court', 'Estate', 'Plaza', 'Garden', 'Apartments', 'Tower'].includes(label)) {
      continue;
    }
    if (['大廈', '中心', '苑', '閣', '廣場', '花園', '公寓', '座'].includes(phrase)) {
      continue;
    }
    if (
      [
        'Subdivided unit',
        'Tenement',
        'Detached house',
        'Village house',
        'Studio',
        'Open plan',
        'Luxury',
        'Luxury Apartments',
        '劏房',
        '唐樓',
        '獨立屋',
        '村屋',
        '工作室',
        '豪華公寓',
      ].includes(label)
    ) {
      continue;
    }
    return label;
  }
  return null;
}

export function localizePropertyTitle(title: string, locale: AppLocale): string {
  return localizePropertyText(title, locale);
}
