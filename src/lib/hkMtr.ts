import type { AppLocale } from './locale';
import { localizePropertyText } from './localizePropertyText';

export const HK_MTR_LINES: Record<string, string[]> = {
  港島線: [
    '堅尼地城',
    '香港大學',
    '西營盤',
    '上環',
    '中環',
    '金鐘',
    '灣仔',
    '銅鑼灣',
    '天后',
    '炮台山',
    '北角',
    '鰂魚涌',
    '太古',
    '西灣河',
    '筲箕灣',
    '杏花邨',
    '柴灣',
  ],
  荃灣線: [
    '荃灣',
    '大窩口',
    '葵興',
    '葵芳',
    '茘景',
    '美孚',
    '茘枝角',
    '長沙灣',
    '深水埗',
    '太子',
    '旺角',
    '油麻地',
    '佐敦',
    '尖沙咀',
    '金鐘',
    '中環',
  ],
  觀塘線: ['黃埔', '何文田', '油麻地', '旺角', '太子', '石硤尾', '九龍塘', '樂富', '黃大仙', '鑽石山', '彩虹', '九龍灣', '牛頭角', '觀塘', '藍田', '油塘', '調景嶺'],
  東涌線: ['香港', '九龍', '奧運', '南昌', '茘景', '青衣', '欣澳', '東涌'],
  將軍澳線: ['北角', '鰂魚涌', '油塘', '調景嶺', '將軍澳', '坑口', '寶琳', '康城'],
  屯馬線: [
    '屯門',
    '兆康',
    '天水圍',
    '朗屏',
    '元朗',
    '錦上路',
    '荃灣西',
    '美孚',
    '南昌',
    '柯士甸',
    '尖東',
    '紅磡',
    '何文田',
    '土瓜灣',
    '宋皇臺',
    '啟德',
    '鑽石山',
    '顯徑',
    '大圍',
    '車公廟',
    '沙田',
    '第一城',
    '石門',
    '大水坑',
    '恆安',
    '馬鞍山',
    '烏溪沙',
  ],
  南港島線: ['海怡半島', '利東', '黃竹坑', '海洋公園', '金鐘'],
  東鐵線: ['金鐘', '會展', '紅磡', '旺角東', '九龍塘', '大圍', '沙田', '火炭', '大學', '大埔墟', '太和', '粉嶺', '上水', '落馬洲', '羅湖'],
};

export const HK_MTR_LINE_NAMES = Object.keys(HK_MTR_LINES);

export function getMtrStationsForLine(line: string): string[] {
  return HK_MTR_LINES[line] ?? [];
}

const MTR_LINE_LABELS: Record<string, Record<AppLocale, string>> = {
  港島線: { 'zh-TW': '港島線', 'zh-CN': '港岛线', en: 'Island Line' },
  荃灣線: { 'zh-TW': '荃灣線', 'zh-CN': '荃湾线', en: 'Tsuen Wan Line' },
  觀塘線: { 'zh-TW': '觀塘線', 'zh-CN': '观塘线', en: 'Kwun Tong Line' },
  東涌線: { 'zh-TW': '東涌線', 'zh-CN': '东涌线', en: 'Tung Chung Line' },
  將軍澳線: { 'zh-TW': '將軍澳線', 'zh-CN': '将军澳线', en: 'Tseung Kwan O Line' },
  屯馬線: { 'zh-TW': '屯馬線', 'zh-CN': '屯马线', en: 'Tuen Ma Line' },
  南港島線: { 'zh-TW': '南港島線', 'zh-CN': '南港岛线', en: 'South Island Line' },
  東鐵線: { 'zh-TW': '東鐵線', 'zh-CN': '东铁线', en: 'East Rail Line' },
};

export function getMtrLineLabel(line: string, locale: AppLocale): string {
  return MTR_LINE_LABELS[line]?.[locale] ?? line;
}

export function getMtrStationLabel(station: string, locale: AppLocale): string {
  return localizePropertyText(station, locale);
}
