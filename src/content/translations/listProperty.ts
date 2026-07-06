import type { AppLocale } from '../../lib/locale';
import { formatMessage } from '../../lib/i18nFormat';

/** Canonical feature tag keys (zh-TW); stored in listing payload. */
export const LISTING_FEATURE_TAG_KEYS = [
  '近地鐵',
  '傢俬電器齊全',
  '獨立廁所',
  '可煮食',
  '可養寵',
  '連天台',
  '有升降機',
  '新裝修',
] as const;

export type ListingFeatureTagKey = (typeof LISTING_FEATURE_TAG_KEYS)[number];

export const LISTING_PROPERTY_TYPE_IDS = [
  'estate',
  'tenement',
  'village',
  'subdivided',
  'house',
  'studio',
] as const;

export type ListingPropertyTypeId = (typeof LISTING_PROPERTY_TYPE_IDS)[number];

const listPropertyZhTW = {
  stepType: '物業類型',
  stepLocation: '位置',
  stepSpecs: '租金規格',
  stepMedia: '相片證明',
  stepPublish: '介紹預覽',
  stepProgress: '步驟 {current} / {total}',

  remove: '移除',
  cancel: '取消',
  back: '上一步',
  next: '下一步',
  submitReview: '提交審核',
  submitting: '提交中…',

  errSelectType: '請選擇物業類型',
  errSelectDistrict: '請選擇地區',
  errEstateName: '請輸入屋苑名稱',
  errBuildingName: '請輸入大廈名稱',
  errFloor: '請輸入有效樓層',
  errUnit: '請輸入有效單位',
  errPrice: '請輸入有效月租金額（HK$1,000 起）',
  errArea: '請輸入實用面積（平方呎）',
  errProofPhoto: '請上傳至少一張實景相片或影片',
  errDeed: '請上傳至少一份房產證明',
  errCover: '請上傳租盤主圖或填寫主圖網址',
  errTitle: '請確認放盤標題',

  purposeTitle: '放盤用途',
  purposeHint: '簡屋目前僅支援住宅出租放盤。',
  rentOut: '出租',
  propertyType: '物業類型',

  districtTitle: '地區',
  districtHint: '請選擇物業所在的香港行政區。',
  districtPlaceholder: '選擇地區（十八區）',
  schoolNetTitle: '校網（選填）',
  schoolNetHint: '與租客搜尋的校網選項一致，方便按校網找盤。',
  schoolNetPlaceholder: '選擇校網',
  schoolNetNone: '不指定校網',

  addressTitle: '地址資料',
  addressHint: '屋苑、大廈、樓層、單位為必填；座數選填。提交後如需修改，須經平台處理。',
  estateName: '屋苑名稱',
  estatePlaceholder: '例如：海濱花園、太古城',
  buildingName: '大廈名稱',
  buildingPlaceholder: '例如：雅賓大廈、某苑某座',
  floor: '樓層',
  unit: '單位',
  unitPlaceholder: '例如：1、12',
  blockTower: '座數（選填）',
  blockPlaceholder: '例如：1座、A座',

  rentTitle: '租金',
  rentHint: '請填寫每月租金（港幣）。',
  areaTitle: '面積',
  areaLabel: '實用面積（呎）',
  buildingAgeTitle: '樓齡（選填）',
  roomConfigTitle: '房間配置（選填）',
  buildingFacilitiesTitle: '大廈設施（選填）',

  coverTitle: '租盤主圖',
  coverHint: '將顯示於搜尋列表；建議橫向相片，光線充足。',
  orImageUrl: '或填寫圖片網址',
  proofTitle: '實景相片',
  proofHint: '至少一張，用作平台審核佐證。請提供足夠相片證明屋內設備以供核實；亦可上傳影片。',
  deedTitle: '房產證明',
  deedHint: '可上傳多張圖片或 PDF，僅供審核，不會公開。',

  listingTitle: '放盤標題',
  titlePlaceholder: '（請先填寫位置與類型）',
  customTitle: '自行修改標題',
  descriptionTitle: '租盤介紹（選填）',
  descriptionPlaceholder: '補充交通、周邊配套、租約要求等…',
  preview: '預覽',
  previewPerMonth: '/月',
  previewMeta: '{area} 呎 · {floor} 樓',
  submitNote: '提交後租盤進入審核，通過後方會出現在租客首頁。請確保資料真實準確。',

  errDbMigration:
    '資料庫尚未套用審核欄位。請執行 supabase/property_listing_verification.sql 及 property_listing_deed_urls.sql 後再試。',
  errSubmitFailed: '新增租盤失敗，請稍後再試。',

  addrEstate: '屋苑：',
  addrBuilding: '大廈：',
  addrBlock: '座數：',
  addrFloor: '樓層：',
  addrUnit: '單位：',
  addrInternalHeader: '地址（內部）：',

  typeEstate: '屋苑',
  typeTenement: '唐樓',
  typeVillage: '村屋',
  typeSubdivided: '劏房',
  typeHouse: '獨立屋',
  typeStudio: '工作室',
} as const;

export type ListPropertyMessages = typeof listPropertyZhTW;

const listPropertyZhCN: ListPropertyMessages = {
  stepType: '物业类型',
  stepLocation: '位置',
  stepSpecs: '租金规格',
  stepMedia: '相片证明',
  stepPublish: '介绍预览',
  stepProgress: '步骤 {current} / {total}',

  remove: '移除',
  cancel: '取消',
  back: '上一步',
  next: '下一步',
  submitReview: '提交审核',
  submitting: '提交中…',

  errSelectType: '请选择物业类型',
  errSelectDistrict: '请选择地区',
  errEstateName: '请输入屋苑名称',
  errBuildingName: '请输入大厦名称',
  errFloor: '请输入有效楼层',
  errUnit: '请输入有效单位',
  errPrice: '请输入有效月租金额（HK$1,000 起）',
  errArea: '请输入实用面积（平方呎）',
  errProofPhoto: '请上传至少一张实景相片或影片',
  errDeed: '请上传至少一份房产证明',
  errCover: '请上传租盘主图或填写主图网址',
  errTitle: '请确认放盘标题',

  purposeTitle: '放盘用途',
  purposeHint: '简屋目前仅支援住宅出租放盘。',
  rentOut: '出租',
  propertyType: '物业类型',

  districtTitle: '地区',
  districtHint: '请选择物业所在的香港行政区。',
  districtPlaceholder: '选择地区（十八区）',
  schoolNetTitle: '校网（选填）',
  schoolNetHint: '与租客搜索的校网选项一致，方便按校网找盘。',
  schoolNetPlaceholder: '选择校网',
  schoolNetNone: '不指定校网',

  addressTitle: '地址资料',
  addressHint: '屋苑、大厦、楼层、单位为必填；座数选填。提交后如需修改，须经平台处理。',
  estateName: '屋苑名称',
  estatePlaceholder: '例如：海滨花园、太古城',
  buildingName: '大厦名称',
  buildingPlaceholder: '例如：雅宾大厦、某苑某座',
  floor: '楼层',
  unit: '单位',
  unitPlaceholder: '例如：1、12',
  blockTower: '座数（选填）',
  blockPlaceholder: '例如：1座、A座',

  rentTitle: '租金',
  rentHint: '请填写每月租金（港币）。',
  areaTitle: '面积',
  areaLabel: '实用面积（呎）',
  buildingAgeTitle: '楼龄（选填）',
  roomConfigTitle: '房间配置（选填）',
  buildingFacilitiesTitle: '大厦设施（选填）',

  coverTitle: '租盘主图',
  coverHint: '将显示于搜索列表；建议横向相片，光线充足。',
  orImageUrl: '或填写图片网址',
  proofTitle: '实景相片',
  proofHint: '至少一张，用作平台审核佐证。请提供足够相片证明屋内设备以供核实；亦可上传影片。',
  deedTitle: '房产证明',
  deedHint: '可上传多张图片或 PDF，仅供审核，不会公开。',

  listingTitle: '放盘标题',
  titlePlaceholder: '（请先填写位置与类型）',
  customTitle: '自行修改标题',
  descriptionTitle: '租盘介绍（选填）',
  descriptionPlaceholder: '补充交通、周边配套、租约要求等…',
  preview: '预览',
  previewPerMonth: '/月',
  previewMeta: '{area} 呎 · {floor} 楼',
  submitNote: '提交后租盘进入审核，通过后方会出现在租客首页。请确保资料真实准确。',

  errDbMigration:
    '数据库尚未套用审核栏位。请执行 supabase/property_listing_verification.sql 及 property_listing_deed_urls.sql 后再试。',
  errSubmitFailed: '新增租盘失败，请稍后再试。',

  addrEstate: '屋苑：',
  addrBuilding: '大厦：',
  addrBlock: '座数：',
  addrFloor: '楼层：',
  addrUnit: '单位：',
  addrInternalHeader: '地址（内部）：',

  typeEstate: '屋苑',
  typeTenement: '唐楼',
  typeVillage: '村屋',
  typeSubdivided: '劏房',
  typeHouse: '独立屋',
  typeStudio: '工作室',
};

const listPropertyEn: ListPropertyMessages = {
  stepType: 'Property type',
  stepLocation: 'Location',
  stepSpecs: 'Rent & specs',
  stepMedia: 'Photos & proof',
  stepPublish: 'Listing preview',
  stepProgress: 'Step {current} / {total}',

  remove: 'Remove',
  cancel: 'Cancel',
  back: 'Back',
  next: 'Next',
  submitReview: 'Submit for Review',
  submitting: 'Submitting…',

  errSelectType: 'Please select a property type',
  errSelectDistrict: 'Please select a district',
  errEstateName: 'Please enter the estate name',
  errBuildingName: 'Please enter the building name',
  errFloor: 'Please enter a valid floor',
  errUnit: 'Please enter a valid unit',
  errPrice: 'Please enter a valid monthly rent (from HK$1,000)',
  errArea: 'Please enter the saleable area (sq ft)',
  errProofPhoto: 'Please upload at least one interior photo or video',
  errDeed: 'Please upload at least one property deed document',
  errCover: 'Please upload a cover image or enter an image URL',
  errTitle: 'Please confirm the listing title',

  purposeTitle: 'Listing purpose',
  purposeHint: 'Thouse currently supports residential rentals only.',
  rentOut: 'For Rent',
  propertyType: 'Property type',

  districtTitle: 'District',
  districtHint: 'Select the Hong Kong district where the property is located.',
  districtPlaceholder: 'Select district (18 districts)',
  schoolNetTitle: 'School Net (Optional)',
  schoolNetHint: 'Matches tenant search school-net filters.',
  schoolNetPlaceholder: 'Select School Net',
  schoolNetNone: 'No School Net',

  addressTitle: 'Address Details',
  addressHint:
    'Estate, building, floor and unit are required; block/tower is optional. Contact the platform to change these after submission.',
  estateName: 'Estate Name',
  estatePlaceholder: 'e.g. Riviera Gardens, Taikoo Shing',
  buildingName: 'Building Name',
  buildingPlaceholder: 'e.g. Apex Building, Block A',
  floor: 'Floor',
  unit: 'Unit',
  unitPlaceholder: 'e.g. 1, 12',
  blockTower: 'Block / tower (optional)',
  blockPlaceholder: 'e.g. Tower 1, Block A',

  rentTitle: 'Rent',
  rentHint: 'Enter the monthly rent in HKD.',
  areaTitle: 'Area',
  areaLabel: 'Saleable area (sq ft)',
  buildingAgeTitle: 'Building Age (Optional)',
  roomConfigTitle: 'Room Features (Optional)',
  buildingFacilitiesTitle: 'Building Facilities (Optional)',

  coverTitle: 'Cover Image',
  coverHint: 'Shown in search results; a well-lit landscape photo is recommended.',
  orImageUrl: 'Or Enter an Image URL',
  proofTitle: 'Interior Photos',
  proofHint:
    'At least one photo for platform verification. Include enough images of the interior and fixtures; videos are also accepted.',
  deedTitle: 'Property Deed',
  deedHint: 'Upload multiple images or PDFs for review only; not shown publicly.',

  listingTitle: 'Listing Title',
  titlePlaceholder: '(Complete location and type first)',
  customTitle: 'Edit Title Manually',
  descriptionTitle: 'Description (Optional)',
  descriptionPlaceholder: 'Transport, nearby amenities, lease requirements, etc.',
  preview: 'Preview',
  previewPerMonth: '/mo',
  previewMeta: '{area} sq ft · Floor {floor}',
  submitNote:
    'After submission your listing enters review and appears on the tenant homepage once approved. Please ensure all details are accurate.',

  errDbMigration:
    'Verification columns are not applied yet. Run supabase/property_listing_verification.sql and property_listing_deed_urls.sql, then try again.',
  errSubmitFailed: 'Could not create listing. Please try again later.',

  addrEstate: 'Estate: ',
  addrBuilding: 'Building: ',
  addrBlock: 'Block: ',
  addrFloor: 'Floor: ',
  addrUnit: 'Unit: ',
  addrInternalHeader: 'Address (internal):',

  typeEstate: 'Estate',
  typeTenement: 'Tenement',
  typeVillage: 'Village House',
  typeSubdivided: 'Subdivided Unit',
  typeHouse: 'Detached House',
  typeStudio: 'Studio',
};

const featureTagLabelsZhTW: Record<ListingFeatureTagKey, string> = {
  近地鐵: '近地鐵',
  傢俬電器齊全: '傢俬電器齊全',
  獨立廁所: '獨立廁所',
  可煮食: '可煮食',
  可養寵: '可養寵',
  連天台: '連天台',
  有升降機: '有升降機',
  新裝修: '新裝修',
};

const featureTagLabelsZhCN: Record<ListingFeatureTagKey, string> = {
  近地鐵: '近地铁',
  傢俬電器齊全: '家具电器齐全',
  獨立廁所: '独立厕所',
  可煮食: '可煮食',
  可養寵: '可养宠',
  連天台: '连天台',
  有升降機: '有升降机',
  新裝修: '新装修',
};

const featureTagLabelsEn: Record<ListingFeatureTagKey, string> = {
  近地鐵: 'Near MTR',
  傢俬電器齊全: 'Furnished With Appliances',
  獨立廁所: 'Private Toilet',
  可煮食: 'Cooking Allowed',
  可養寵: 'Pets Allowed',
  連天台: 'With Rooftop',
  有升降機: 'With Lift',
  新裝修: 'Newly Renovated',
};

export const listPropertyMessages: Record<AppLocale, ListPropertyMessages> = {
  'zh-TW': listPropertyZhTW,
  'zh-CN': listPropertyZhCN,
  en: listPropertyEn,
};

const featureTagLabelsByLocale: Record<AppLocale, Record<ListingFeatureTagKey, string>> = {
  'zh-TW': featureTagLabelsZhTW,
  'zh-CN': featureTagLabelsZhCN,
  en: featureTagLabelsEn,
};

const propertyTypeLabelKey: Record<ListingPropertyTypeId, keyof ListPropertyMessages> = {
  estate: 'typeEstate',
  tenement: 'typeTenement',
  village: 'typeVillage',
  subdivided: 'typeSubdivided',
  house: 'typeHouse',
  studio: 'typeStudio',
};

export function getListingPropertyTypes(locale: AppLocale): { id: ListingPropertyTypeId; label: string }[] {
  const messages = listPropertyMessages[locale];
  return LISTING_PROPERTY_TYPE_IDS.map((id) => ({
    id,
    label: messages[propertyTypeLabelKey[id]],
  }));
}

export function getListingFeatureTags(locale: AppLocale): string[] {
  const labels = featureTagLabelsByLocale[locale];
  return LISTING_FEATURE_TAG_KEYS.map((key) => labels[key]);
}

/** Display label for a canonical feature tag key in the given locale. */
export function getListingFeatureTagLabel(locale: AppLocale, key: ListingFeatureTagKey): string {
  return featureTagLabelsByLocale[locale][key];
}

export function buildListPropertyT(locale: AppLocale) {
  const messages = listPropertyMessages[locale];
  const featureTags = featureTagLabelsByLocale[locale];
  return {
    ...messages,
    featureTags,
    format(key: keyof ListPropertyMessages, vars?: Record<string, string | number>) {
      return formatMessage(messages[key], vars);
    },
    featureTag(key: ListingFeatureTagKey) {
      return featureTags[key];
    },
  };
}
