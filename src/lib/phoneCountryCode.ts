export const DEFAULT_PHONE_COUNTRY_CODE = '+852';

export const PHONE_COUNTRY_LABEL_KEYS = [
  'phoneRegionHK',
  'phoneRegionCN',
  'phoneRegionMO',
  'phoneRegionTW',
  'phoneRegionJP',
  'phoneRegionKR',
  'phoneRegionSG',
  'phoneRegionMY',
  'phoneRegionTH',
  'phoneRegionVN',
  'phoneRegionPH',
  'phoneRegionID',
  'phoneRegionIN',
  'phoneRegionUS',
  'phoneRegionGB',
] as const;

export type PhoneCountryLabelKey = (typeof PHONE_COUNTRY_LABEL_KEYS)[number];

export type PhoneCountryOption = {
  code: string;
  iso2: string;
  labelKey: PhoneCountryLabelKey;
};

/** 香港優先，其後為大中華、其他亞洲、歐美。 */
export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: '+852', iso2: 'hk', labelKey: 'phoneRegionHK' },
  { code: '+86', iso2: 'cn', labelKey: 'phoneRegionCN' },
  { code: '+853', iso2: 'mo', labelKey: 'phoneRegionMO' },
  { code: '+886', iso2: 'tw', labelKey: 'phoneRegionTW' },
  { code: '+81', iso2: 'jp', labelKey: 'phoneRegionJP' },
  { code: '+82', iso2: 'kr', labelKey: 'phoneRegionKR' },
  { code: '+65', iso2: 'sg', labelKey: 'phoneRegionSG' },
  { code: '+60', iso2: 'my', labelKey: 'phoneRegionMY' },
  { code: '+66', iso2: 'th', labelKey: 'phoneRegionTH' },
  { code: '+84', iso2: 'vn', labelKey: 'phoneRegionVN' },
  { code: '+63', iso2: 'ph', labelKey: 'phoneRegionPH' },
  { code: '+62', iso2: 'id', labelKey: 'phoneRegionID' },
  { code: '+91', iso2: 'in', labelKey: 'phoneRegionIN' },
  { code: '+1', iso2: 'us', labelKey: 'phoneRegionUS' },
  { code: '+44', iso2: 'gb', labelKey: 'phoneRegionGB' },
];

export const PHONE_COUNTRY_CODES = PHONE_COUNTRY_OPTIONS.map((option) => option.code);

export function getPhoneCountryOption(code: string): PhoneCountryOption | undefined {
  return PHONE_COUNTRY_OPTIONS.find((option) => option.code === code);
}

export function normalizePhoneCountryCode(raw: string) {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  const digits = cleaned.replace(/\+/g, '');
  return `+${digits}`.slice(0, 5);
}

export function isValidPhoneCountryCode(code: string) {
  return /^\+\d{1,4}$/.test(normalizePhoneCountryCode(code));
}

export function formatPhoneWithCountryCode(countryCode: string, localNumber: string) {
  const code = normalizePhoneCountryCode(countryCode) || DEFAULT_PHONE_COUNTRY_CODE;
  const digits = localNumber.trim().replace(/\s+/g, ' ');
  if (!digits) return '';
  return `${code} ${digits}`.trim();
}

export function splitPhoneNumber(raw: string): { countryCode: string; localNumber: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { countryCode: DEFAULT_PHONE_COUNTRY_CODE, localNumber: '' };
  }

  const compact = trimmed.replace(/\s+/g, '');
  const sorted = [...PHONE_COUNTRY_CODES].sort((a, b) => b.length - a.length);
  for (const code of sorted) {
    if (compact.startsWith(code)) {
      return { countryCode: code, localNumber: compact.slice(code.length) };
    }
  }

  const plusMatch = compact.match(/^(\+\d{1,4})(.*)$/);
  if (plusMatch) {
    return { countryCode: plusMatch[1], localNumber: plusMatch[2] };
  }

  return { countryCode: DEFAULT_PHONE_COUNTRY_CODE, localNumber: compact };
}

export function formatPhoneForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const { countryCode, localNumber } = splitPhoneNumber(trimmed);
  return formatPhoneWithCountryCode(countryCode, localNumber);
}
