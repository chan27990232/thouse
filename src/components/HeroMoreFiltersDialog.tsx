import { useEffect, useState, type ReactNode } from 'react';
import { Building, Layers, MapPin, Maximize2, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { cn } from './ui/utils';

const NAVY = '#1a365d' as const;

export const HERO_AREA_SQFT_MAX = 2000;

const TUBE_LINES = ['港島線', '荃灣線', '觀塘線', '東涌線', '將軍澳線', '屯馬線', '南港島線', '東鐵線'];
const SCHOOLS = ['拔萃女書院', '喇沙書院', '聖保羅男女中學', '華仁書院', '真光女書院', '皇仁書院', '英華女學校'];
const AMENITIES = ['停車場', '健身房', '游泳池', '24小時保安', '會所', '花園'];

const FLOOR_OPTIONS: { value: 'low' | 'mid' | 'high'; label: string }[] = [
  { value: 'low', label: '低層 (1–5)' },
  { value: 'mid', label: '中層 (6–15)' },
  { value: 'high', label: '高層 (16+)' },
];

const AGE_OPTIONS: { value: 'new' | '5-10' | '10-20' | '20+'; label: string }[] = [
  { value: 'new', label: '5年以下' },
  { value: '5-10', label: '5–10年' },
  { value: '10-20', label: '10–20年' },
  { value: '20+', label: '20年以上' },
];

export interface HeroMoreFiltersValues {
  areaType: 'tube' | 'school' | '';
  selectedArea: string;
  areaRange: [number, number];
  floorLevel: 'low' | 'mid' | 'high' | '';
  buildingAge: 'new' | '5-10' | '10-20' | '20+' | '';
  hasPrivateToilet: boolean;
  amenities: string[];
}

export const DEFAULT_HERO_MORE_FILTERS: HeroMoreFiltersValues = {
  areaType: '',
  selectedArea: '',
  areaRange: [0, HERO_AREA_SQFT_MAX],
  floorLevel: '',
  buildingAge: '',
  hasPrivateToilet: false,
  amenities: [],
};

export function countActiveHeroMoreFilters(values: HeroMoreFiltersValues): number {
  let n = 0;
  if (values.areaType && values.selectedArea) n += 1;
  if (values.areaRange[0] > 0 || values.areaRange[1] < HERO_AREA_SQFT_MAX) n += 1;
  if (values.floorLevel) n += 1;
  if (values.buildingAge) n += 1;
  if (values.hasPrivateToilet) n += 1;
  n += values.amenities.length;
  return n;
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
  const [draft, setDraft] = useState<HeroMoreFiltersValues>(values);

  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const setAreaType = (areaType: 'tube' | 'school' | '') => {
    setDraft((prev) => ({
      ...prev,
      areaType,
      selectedArea: prev.areaType === areaType ? prev.selectedArea : '',
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

  const handleReset = () => setDraft(DEFAULT_HERO_MORE_FILTERS);

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const areaOptions = draft.areaType === 'tube' ? TUBE_LINES : draft.areaType === 'school' ? SCHOOLS : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-gray-100 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg" style={{ color: NAVY }}>
            <SlidersHorizontal className="h-5 w-5" />
            更多篩選
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            進階條件會與上方地區、租金、房間數一併套用。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Section icon={<MapPin className="h-4 w-4" />} title="地鐵線／校網">
            <div className="mb-3 flex flex-wrap gap-2">
              <FilterPill active={draft.areaType === 'tube'} onClick={() => setAreaType(draft.areaType === 'tube' ? '' : 'tube')}>
                按地鐵線
              </FilterPill>
              <FilterPill
                active={draft.areaType === 'school'}
                onClick={() => setAreaType(draft.areaType === 'school' ? '' : 'school')}
              >
                按校網
              </FilterPill>
            </div>
            {draft.areaType ? (
              <div className="flex flex-wrap gap-2">
                {areaOptions.map((item) => (
                  <FilterPill
                    key={item}
                    active={draft.selectedArea === item}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        selectedArea: prev.selectedArea === item ? '' : item,
                      }))
                    }
                  >
                    {item}
                  </FilterPill>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">可選：以地鐵站或學校附近搜尋（與左側「地區」擇一使用）。</p>
            )}
          </Section>

          <Section icon={<Maximize2 className="h-4 w-4" />} title="實用面積（平方呎）">
            <p
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums text-gray-800"
              aria-live="polite"
            >
              <span>
                最少 <strong style={{ color: NAVY }}>{draft.areaRange[0].toLocaleString('en-HK')}</strong> 呎
              </span>
              <span className="text-gray-300">|</span>
              <span>
                最多{' '}
                <strong style={{ color: NAVY }}>
                  {draft.areaRange[1].toLocaleString('en-HK')}
                  {draft.areaRange[1] >= HERO_AREA_SQFT_MAX ? '+' : ''}
                </strong>{' '}
                呎
              </span>
            </p>
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
              <span>0 呎</span>
              <span>{HERO_AREA_SQFT_MAX.toLocaleString('en-HK')}+ 呎</span>
            </div>
          </Section>

          <Section icon={<Layers className="h-4 w-4" />} title="樓層">
            <div className="flex flex-wrap gap-2">
              {FLOOR_OPTIONS.map(({ value, label }) => (
                <FilterPill
                  key={value}
                  active={draft.floorLevel === value}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      floorLevel: prev.floorLevel === value ? '' : value,
                    }))
                  }
                >
                  {label}
                </FilterPill>
              ))}
            </div>
          </Section>

          <Section icon={<Building className="h-4 w-4" />} title="樓齡">
            <div className="flex flex-wrap gap-2">
              {AGE_OPTIONS.map(({ value, label }) => (
                <FilterPill
                  key={value}
                  active={draft.buildingAge === value}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      buildingAge: prev.buildingAge === value ? '' : value,
                    }))
                  }
                >
                  {label}
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
              <Label htmlFor="hero-more-toilet" className="cursor-pointer text-sm font-medium text-gray-900">
                獨立洗手間
              </Label>
            </div>
            <div>
              <Label className="mb-2 block text-sm font-semibold text-gray-900">大廈設施</Label>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((name) => (
                  <FilterPill key={name} active={draft.amenities.includes(name)} onClick={() => toggleAmenity(name)}>
                    {name}
                  </FilterPill>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-gray-100 bg-white px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" onClick={handleReset}>
            重設
          </Button>
          <Button
            type="button"
            className="flex-1 text-white hover:opacity-95"
            style={{ backgroundColor: NAVY }}
            onClick={handleApply}
          >
            套用篩選
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
