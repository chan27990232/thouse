/** 放盤表單選項（參考業界放盤流程，簡屋租賃專用） */

export const LISTING_PROPERTY_TYPES = [
  { id: 'estate', label: '屋苑' },
  { id: 'tenement', label: '唐樓' },
  { id: 'village', label: '村屋' },
  { id: 'subdivided', label: '劏房' },
  { id: 'house', label: '獨立屋' },
  { id: 'studio', label: '工作室' },
] as const;

export type ListingPropertyTypeId = (typeof LISTING_PROPERTY_TYPES)[number]['id'];

export const LISTING_UNIT_LABELS: Record<ListingPropertyTypeId, string> = {
  estate: '單位',
  tenement: '單位',
  village: '全層',
  subdivided: '劏房',
  house: '全幢',
  studio: '工作室',
};

export const LISTING_FEATURE_TAGS = [
  '近地鐵',
  '傢俬電器齊全',
  '獨立廁所',
  '可煮食',
  '可養寵',
  '連天台',
  '有升降機',
  '新裝修',
] as const;

export const LISTING_ROOM_OPTIONS = [0, 1, 2, 3, 4] as const;

export function buildListingTitle(input: {
  areaLabel: string;
  buildingName: string;
  propertyTypeId: ListingPropertyTypeId | '';
}): string {
  const typeLabel =
    LISTING_PROPERTY_TYPES.find((t) => t.id === input.propertyTypeId)?.label ?? '';
  const parts = [input.areaLabel.trim(), input.buildingName.trim(), typeLabel].filter(Boolean);
  return parts.join(' ');
}

export function buildListingDescription(input: {
  description: string;
  features: string[];
  propertyTypeId: ListingPropertyTypeId | '';
  district: string;
}): string {
  const typeLabel =
    LISTING_PROPERTY_TYPES.find((t) => t.id === input.propertyTypeId)?.label ?? '';
  const lines: string[] = [];
  if (input.district) lines.push(`地區：${input.district}`);
  if (typeLabel) lines.push(`類型：${typeLabel}`);
  if (input.features.length > 0) lines.push(`特色：${input.features.join('、')}`);
  const body = input.description.trim();
  if (body) lines.push('', body);
  return lines.join('\n').trim();
}
