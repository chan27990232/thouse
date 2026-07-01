import type { BuildingAge, FloorLevel } from '../components/HeroMoreFiltersDialog';
import { HERO_AREA_SQFT_MAX } from '../components/HeroMoreFiltersDialog';
import type { AppLocale } from './locale';
import { homeMessages } from '../content/translations/home';
import { filtersMessages } from '../content/translations/filters';
import { getDistrictLabel } from './hkDistricts';

const STORAGE_KEY = 'thouse:hero-search-history';
const MAX_ENTRIES = 10;
const HERO_PRICE_MAX = 80000;

export interface HeroSearchSnapshot {
  searchQuery: string;
  areaType: 'district' | 'tube' | 'school';
  selectedDistrict: string;
  selectedTubeLine: string;
  selectedTubeStation: string;
  selectedSchoolNet: string;
  priceRange: [number, number];
  areaRange: [number, number];
  floorLevels: FloorLevel[];
  buildingAges: BuildingAge[];
  hasToilet: boolean;
  amenities: string[];
  roomFilter: string;
  heroUnitType: string;
}

export interface HeroSearchHistoryEntry extends HeroSearchSnapshot {
  id: string;
  savedAt: string;
}

function snapshotKey(snapshot: HeroSearchSnapshot): string {
  return JSON.stringify(snapshot);
}

function isDefaultSnapshot(snapshot: HeroSearchSnapshot): boolean {
  const q = snapshot.searchQuery.trim();
  if (q) return false;
  if (snapshot.selectedDistrict) return false;
  if (snapshot.areaType === 'tube' && (snapshot.selectedTubeLine || snapshot.selectedTubeStation)) return false;
  if (snapshot.areaType === 'school' && snapshot.selectedSchoolNet) return false;
  if (snapshot.priceRange[0] > 0 || snapshot.priceRange[1] < HERO_PRICE_MAX) return false;
  if (snapshot.areaRange[0] > 0 || snapshot.areaRange[1] < HERO_AREA_SQFT_MAX) return false;
  if (snapshot.floorLevels.length > 0) return false;
  if (snapshot.buildingAges.length > 0) return false;
  if (snapshot.hasToilet) return false;
  if (snapshot.amenities.length > 0) return false;
  if (snapshot.roomFilter) return false;
  if (snapshot.heroUnitType !== 'any') return false;
  return true;
}

export function loadHeroSearchHistory(): HeroSearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HeroSearchHistoryEntry =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as HeroSearchHistoryEntry).id === 'string' &&
        typeof (item as HeroSearchHistoryEntry).savedAt === 'string'
    );
  } catch {
    return [];
  }
}

function persist(entries: HeroSearchHistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function saveHeroSearchHistory(snapshot: HeroSearchSnapshot): HeroSearchHistoryEntry[] {
  if (isDefaultSnapshot(snapshot)) return loadHeroSearchHistory();

  const key = snapshotKey(snapshot);
  const existing = loadHeroSearchHistory().filter((e) => snapshotKey(e) !== key);
  const entry: HeroSearchHistoryEntry = {
    ...snapshot,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  persist(next);
  return next;
}

export function removeHeroSearchHistoryEntry(id: string): HeroSearchHistoryEntry[] {
  const next = loadHeroSearchHistory().filter((e) => e.id !== id);
  persist(next);
  return next;
}

export function clearHeroSearchHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

const ROOM_KEYS: Record<string, keyof typeof homeMessages['zh-TW']> = {
  studio: 'studio',
  '1': 'oneBed',
  '2': 'twoBed',
  '3+': 'threePlusBed',
};

const UNIT_KEYS: Record<string, keyof typeof homeMessages['zh-TW']> = {
  residential: 'residential',
  service: 'serviceApartment',
  workshop: 'workshop',
};

export function formatHeroSearchHistoryLabel(entry: HeroSearchSnapshot, locale: AppLocale): string {
  const t = homeMessages[locale];
  const ft = filtersMessages[locale];
  const parts: string[] = [];
  const q = entry.searchQuery.trim();
  if (q) parts.push(q);

  if (entry.areaType === 'district' && entry.selectedDistrict) {
    parts.push(getDistrictLabel(entry.selectedDistrict, locale));
  } else if (entry.areaType === 'tube') {
    if (entry.selectedTubeStation) parts.push(entry.selectedTubeStation);
    else if (entry.selectedTubeLine) parts.push(entry.selectedTubeLine);
  } else if (entry.areaType === 'school' && entry.selectedSchoolNet) {
    parts.push(entry.selectedSchoolNet);
  }

  const [minP, maxP] = entry.priceRange;
  if (minP > 0 || maxP < HERO_PRICE_MAX) {
    const minLabel = minP > 0 ? `HK$${minP.toLocaleString()}` : 'HK$0';
    const maxLabel = maxP < HERO_PRICE_MAX ? `HK$${maxP.toLocaleString()}` : ft.priceUnlimited;
    parts.push(`${minLabel}–${maxLabel}`);
  }

  const roomKey = entry.roomFilter ? ROOM_KEYS[entry.roomFilter] : undefined;
  if (roomKey) parts.push(t[roomKey]);

  const unitKey = entry.heroUnitType !== 'any' ? UNIT_KEYS[entry.heroUnitType] : undefined;
  if (unitKey) parts.push(t[unitKey]);

  const extra =
    (entry.floorLevels.length > 0 ? 1 : 0) +
    (entry.buildingAges.length > 0 ? 1 : 0) +
    (entry.hasToilet ? 1 : 0) +
    entry.amenities.length +
    (entry.areaRange[0] > 0 || entry.areaRange[1] < HERO_AREA_SQFT_MAX ? 1 : 0);

  if (extra > 0) {
    parts.push(ft.extraFilters.replace('{count}', String(extra)));
  }

  return parts.length > 0 ? parts.join(' · ') : ft.searchCriteria;
}
