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
