import { useEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  Layers,
  MapPin,
  Maximize2,
  SlidersHorizontal,
  Dumbbell,
  Car,
  Waves,
  Home,
  Flower2,
  Baby,
  CircleDot,
  Trophy,
  Bath,
  Footprints,
  BookOpen,
  Shield,
  UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { cn } from './ui/utils';
import { HK_MTR_LINE_NAMES, getMtrStationsForLine } from '../lib/hkMtr';
import { HK_SCHOOL_NETS } from '../lib/hkSchoolNets';
import { useLocale } from '../context/LocaleContext';

const NAVY = '#1a365d' as const;

export const HERO_AREA_SQFT_MAX = 2000;

export const BUILDING_AMENITIES: { name: string; icon: LucideIcon }[] = [
  { name: '升降機', icon: Building2 },
  { name: '停車場', icon: Car },
  { name: '健身房', icon: Dumbbell },
  { name: '游泳池', icon: Waves },
  { name: '會所', icon: Home },
  { name: '花園', icon: Flower2 },
  { name: '兒童遊樂場', icon: Baby },
  { name: '乒乓球場', icon: CircleDot },
  { name: '網球場', icon: Trophy },
  { name: '桑拿浴室', icon: Bath },
  { name: '緩跑徑', icon: Footprints },
  { name: '籃球場', icon: CircleDot },
  { name: '瑜伽室', icon: Flower2 },
  { name: '圖書館', icon: BookOpen },
  { name: '燒烤區', icon: UtensilsCrossed },
  { name: '24小時保安', icon: Shield },
];

const FLOOR_OPTION_VALUES: { value: FloorLevel }[] = [
  { value: 'low' },
  { value: 'mid' },
  { value: 'high' },
];

const AGE_OPTION_VALUES: { value: BuildingAge }[] = [
  { value: 'new' },
  { value: '5-10' },
  { value: '10-20' },
  { value: '20+' },
];

export type FloorLevel = 'low' | 'mid' | 'high';
export type BuildingAge = 'new' | '5-10' | '10-20' | '20+';

export interface HeroMoreFiltersValues {
  areaType: 'tube' | 'school' | '';
  selectedTubeLine: string;
  selectedTubeStation: string;
  selectedSchoolNet: string;
  areaRange: [number, number];
  floorLevels: FloorLevel[];
  buildingAges: BuildingAge[];
  hasPrivateToilet: boolean;
  amenities: string[];
}

export const DEFAULT_HERO_MORE_FILTERS: HeroMoreFiltersValues = {
  areaType: '',
  selectedTubeLine: '',
  selectedTubeStation: '',
  selectedSchoolNet: '',
  areaRange: [0, HERO_AREA_SQFT_MAX],
  floorLevels: [],
  buildingAges: [],
  hasPrivateToilet: false,
  amenities: [],
};

export function countActiveHeroMoreFilters(values: HeroMoreFiltersValues): number {
  let n = 0;
  if (values.areaType === 'tube' && values.selectedTubeLine) n += 1;
  if (values.areaType === 'tube' && values.selectedTubeStation) n += 1;
  if (values.areaType === 'school' && values.selectedSchoolNet) n += 1;
  if (values.areaRange[0] > 0 || values.areaRange[1] < HERO_AREA_SQFT_MAX) n += 1;
  n += values.floorLevels.length;
  n += values.buildingAges.length;
  if (values.hasPrivateToilet) n += 1;
  n += values.amenities.length;
  return n;
}

function clampArea(value: number): number {
  return Math.min(HERO_AREA_SQFT_MAX, Math.max(0, value));
}

function parseAreaInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return clampArea(Number(digits));
}

function FilterPill({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-[#1a365d] bg-[#1a365d] text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
        className
      )}
    >
      {children}
    </button>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="text-gray-500">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

interface HeroMoreFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: HeroMoreFiltersValues;
  onApply: (values: HeroMoreFiltersValues) => void;
}

export function HeroMoreFiltersDialog({ open, onOpenChange, values, onApply }: HeroMoreFiltersDialogProps) {
  const { homeT, filtersT, commonT } = useLocale();
  const [draft, setDraft] = useState<HeroMoreFiltersValues>(values);

  const floorLabels: Record<FloorLevel, string> = {
    low: filtersT.floorLow,
    mid: filtersT.floorMid,
    high: filtersT.floorHigh,
  };

  const ageLabels: Record<BuildingAge, string> = {
    new: commonT.buildingAgeNew,
    '5-10': commonT.buildingAge5_10,
    '10-20': commonT.buildingAge10_20,
    '20+': commonT.buildingAge20Plus,
  };

  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const setAreaType = (areaType: 'tube' | 'school' | '') => {
    setDraft((prev) => ({
      ...prev,
      areaType: prev.areaType === areaType ? '' : areaType,
      selectedTubeLine: '',
      selectedTubeStation: '',
      selectedSchoolNet: '',
    }));
  };

  const toggleAmenity = (name: string) => {
    setDraft((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(name)
        ? prev.amenities.filter((a) => a !== name)
        : [...prev.amenities, name],
    }));
  };

  const toggleFloorLevel = (value: FloorLevel) => {
    setDraft((prev) => ({
      ...prev,
      floorLevels: prev.floorLevels.includes(value)
        ? prev.floorLevels.filter((v) => v !== value)
        : [...prev.floorLevels, value],
    }));
  };

  const toggleBuildingAge = (value: BuildingAge) => {
    setDraft((prev) => ({
      ...prev,
      buildingAges: prev.buildingAges.includes(value)
        ? prev.buildingAges.filter((v) => v !== value)
        : [...prev.buildingAges, value],
    }));
  };

  const handleReset = () => setDraft(DEFAULT_HERO_MORE_FILTERS);

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const tubeStations = draft.selectedTubeLine ? getMtrStationsForLine(draft.selectedTubeLine) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-gray-100 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
            <SlidersHorizontal className="h-5 w-5" />
            {homeT.moreFilters}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {filtersT.description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Section icon={<MapPin className="h-4 w-4" />} title={filtersT.tubeSchoolSection}>
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterPill active={draft.areaType === 'tube'} onClick={() => setAreaType(draft.areaType === 'tube' ? '' : 'tube')}>
                {filtersT.byMtr}
              </FilterPill>
              <FilterPill
                active={draft.areaType === 'school'}
                onClick={() => setAreaType(draft.areaType === 'school' ? '' : 'school')}
              >
                {filtersT.bySchoolNet}
              </FilterPill>
            </div>

            {draft.areaType === 'tube' ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-600">{filtersT.selectMtrLine}</p>
                  <div className="flex flex-wrap gap-2">
                    {HK_MTR_LINE_NAMES.map((line) => (
                      <FilterPill
                        key={line}
                        active={draft.selectedTubeLine === line}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            selectedTubeLine: prev.selectedTubeLine === line ? '' : line,
                            selectedTubeStation: '',
                          }))
                        }
                      >
                        {line}
                      </FilterPill>
                    ))}
                  </div>
                </div>
                {draft.selectedTubeLine ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-600">
                      {filtersT.format('selectStation', { line: draft.selectedTubeLine })}
                    </p>
                    <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                      {tubeStations.map((station) => (
                        <FilterPill
                          key={station}
                          active={draft.selectedTubeStation === station}
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              selectedTubeStation: prev.selectedTubeStation === station ? '' : station,
                            }))
                          }
                        >
                          {station}
                        </FilterPill>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {draft.areaType === 'school' ? (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-600">{filtersT.selectSchoolNet}</p>
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {HK_SCHOOL_NETS.map((net) => (
                    <FilterPill
                      key={net}
                      active={draft.selectedSchoolNet === net}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          selectedSchoolNet: prev.selectedSchoolNet === net ? '' : net,
                        }))
                      }
                    >
                      {net}
                    </FilterPill>
                  ))}
                </div>
              </div>
            ) : null}

            {!draft.areaType ? (
              <p className="text-xs text-gray-500">{filtersT.tubeSchoolHint}</p>
            ) : null}
          </Section>

          <Section icon={<Maximize2 className="h-4 w-4" />} title={filtersT.areaSection}>
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
              <label className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="shrink-0 text-xs text-gray-600">{filtersT.areaMin}</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label={filtersT.areaMinAria}
                  value={draft.areaRange[0] === 0 ? '' : String(draft.areaRange[0])}
                  placeholder="0"
                  onChange={(e) => {
                    const nextMin = parseAreaInput(e.target.value);
                    setDraft((prev) => ({
                      ...prev,
                      areaRange: [Math.min(nextMin, prev.areaRange[1]), prev.areaRange[1]],
                    }));
                  }}
                  onBlur={() =>
                    setDraft((prev) => ({
                      ...prev,
                      areaRange: [clampArea(prev.areaRange[0]), prev.areaRange[1]],
                    }))
                  }
                  className="h-9 border-gray-200 bg-white text-sm tabular-nums shadow-sm"
                />
                <span className="shrink-0 text-xs text-gray-500">{homeT.sqft}</span>
              </label>
              <span className="text-gray-300">—</span>
              <label className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="shrink-0 text-xs text-gray-600">{filtersT.areaMax}</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label={filtersT.areaMaxAria}
                  value={draft.areaRange[1] >= HERO_AREA_SQFT_MAX ? '' : String(draft.areaRange[1])}
                  placeholder={`${HERO_AREA_SQFT_MAX}+`}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    const nextMax = digits ? clampArea(Number(digits)) : HERO_AREA_SQFT_MAX;
                    setDraft((prev) => ({
                      ...prev,
                      areaRange: [prev.areaRange[0], Math.max(nextMax, prev.areaRange[0])],
                    }));
                  }}
                  onBlur={() =>
                    setDraft((prev) => ({
                      ...prev,
                      areaRange: [prev.areaRange[0], clampArea(prev.areaRange[1])],
                    }))
                  }
                  className="h-9 border-gray-200 bg-white text-sm tabular-nums shadow-sm"
                />
                <span className="shrink-0 text-xs text-gray-500">{homeT.sqft}</span>
              </label>
            </div>
            <Slider
              value={draft.areaRange}
              onValueChange={(v) => setDraft((prev) => ({ ...prev, areaRange: v as [number, number] }))}
              min={0}
              max={HERO_AREA_SQFT_MAX}
              step={50}
              className="touch-manipulation"
              rangeStyle={{ backgroundColor: NAVY }}
              thumbStyle={{
                backgroundColor: NAVY,
                borderColor: NAVY,
                borderWidth: 2,
                width: 18,
                height: 18,
              }}
            />
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>{filtersT.areaMinLabel}</span>
              <span>{filtersT.format('areaMaxLabel', { max: HERO_AREA_SQFT_MAX.toLocaleString('en-HK') })}</span>
            </div>
          </Section>

          <Section icon={<Layers className="h-4 w-4" />} title={filtersT.floorSection}>
            <div className="flex flex-wrap gap-2">
              {FLOOR_OPTION_VALUES.map(({ value }) => (
                <FilterPill key={value} active={draft.floorLevels.includes(value)} onClick={() => toggleFloorLevel(value)}>
                  {floorLabels[value]}
                </FilterPill>
              ))}
            </div>
          </Section>

          <Section icon={<Building2 className="h-4 w-4" />} title={filtersT.ageSection}>
            <div className="flex flex-wrap gap-2">
              {AGE_OPTION_VALUES.map(({ value }) => (
                <FilterPill key={value} active={draft.buildingAges.includes(value)} onClick={() => toggleBuildingAge(value)}>
                  {ageLabels[value]}
                </FilterPill>
              ))}
            </div>
          </Section>

          <section className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hero-more-toilet"
                checked={draft.hasPrivateToilet}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, hasPrivateToilet: checked === true }))
                }
              />
              <Label htmlFor="hero-more-toilet" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900">
                <Bath className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.75} aria-hidden />
                {homeT.privateBathroom}
              </Label>
            </div>
            <div>
              <Label className="mb-2 block text-sm font-semibold text-gray-900">{filtersT.buildingFacilities}</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BUILDING_AMENITIES.map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleAmenity(name)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors sm:text-sm',
                      draft.amenities.includes(name)
                        ? 'border-[#1a365d] bg-[#1a365d] text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 leading-tight">{filtersT.amenity(name)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-gray-100 bg-white px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" onClick={handleReset}>
            {filtersT.reset}
          </Button>
          <Button
            type="button"
            className="flex-1 text-white hover:opacity-95"
            style={{ backgroundColor: NAVY }}
            onClick={handleApply}
          >
            {filtersT.apply}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
