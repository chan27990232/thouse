/** Canonical keys shared by tenant search filters and landlord listing form. */

export const PROPERTY_ROOM_FEATURE_KEYS = [
  '獨立洗手間',
  '冰箱',
  '單人床',
  '雙人床',
  '沙發',
  '洗衣機',
  '冷氣',
  '電視',
] as const;

export type PropertyRoomFeatureKey = (typeof PROPERTY_ROOM_FEATURE_KEYS)[number];

export const PROPERTY_BUILDING_AMENITY_KEYS = ['升降機', '停車場', '24小時保安'] as const;

export type PropertyBuildingAmenityKey = (typeof PROPERTY_BUILDING_AMENITY_KEYS)[number];

export type PropertyBuildingAge = 'new' | '5-10' | '10-20' | '20+';

export const PROPERTY_BUILDING_AGE_VALUES: PropertyBuildingAge[] = ['new', '5-10', '10-20', '20+'];

/** Derive legacy age bucket from built year for tenant search filters. */
export function buildingAgeFromBuiltYear(
  builtYear: number,
  referenceYear: number = new Date().getFullYear(),
): PropertyBuildingAge {
  const age = referenceYear - builtYear;
  if (age < 5) return 'new';
  if (age <= 10) return '5-10';
  if (age <= 20) return '10-20';
  return '20+';
}

export function parsePropertyYear(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 4) return null;
  const year = Number(digits);
  const max = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1800 || year > max) return null;
  return year;
}