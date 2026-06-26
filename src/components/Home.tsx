import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Bell, MessageCircle, User, SlidersHorizontal, House, Home as HomeIcon, Heart, X } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import { Property, UserRole } from '../App';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import {
  countActiveHeroMoreFilters,
  DEFAULT_HERO_MORE_FILTERS,
  HERO_AREA_SQFT_MAX,
  HeroMoreFiltersDialog,
  type BuildingAge,
  type FloorLevel,
  type HeroMoreFiltersValues,
} from './HeroMoreFiltersDialog';
import { NoticeDialog } from './NoticeDialog';
import { HK_DISTRICTS } from '../lib/hkDistricts';
import { loadHomepageProperties } from '../lib/properties';
import { fetchUnreadInquiryCount } from '../lib/conversations';
import { textMatchesQuery } from '../lib/searchText';
import { getMtrStationsForLine } from '../lib/hkMtr';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { ThouseHomeFooter } from './ThouseHomeFooter';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLocale } from '../context/LocaleContext';
import { cn } from './ui/utils';

/** Design mockup: deep navy for primary text, CTA, slider */
const NAVY = '#1a365d' as const;

/** 首頁英雄區租金雙向滑桿：0 – 80,000（與搜尋彈窗一致） */
const HERO_PRICE_MAX = 80000;

function clampHeroPrice(value: number): number {
  return Math.min(HERO_PRICE_MAX, Math.max(0, value));
}

function parseHeroPriceInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return clampHeroPrice(Number(digits));
}

interface HomeProps {
  onAuthClick: (role: 'tenant' | 'landlord') => void;
  isAuthenticated: boolean;
  userRole: UserRole;
  onSignOut: () => void;
  onPropertyClick: (property: Property) => void;
  onLandlordDashboard: () => void;
  onChatClick: () => void;
  onProfileClick: () => void;
  onMyPropertiesClick: () => void;
}

export function Home({
  onAuthClick,
  isAuthenticated,
  userRole,
  onPropertyClick,
  onLandlordDashboard,
  onChatClick,
  onProfileClick,
  onMyPropertiesClick,
}: HomeProps) {
  const { homeT, commonT } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const [areaType, setAreaType] = useState<'district' | 'tube' | 'school'>('district');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedTubeLine, setSelectedTubeLine] = useState<string>('');
  const [selectedTubeStation, setSelectedTubeStation] = useState<string>('');
  const [selectedSchoolNet, setSelectedSchoolNet] = useState<string>('');
  const [priceRange, setPriceRange] = useState([0, HERO_PRICE_MAX]);
  const [areaRange, setAreaRange] = useState<[number, number]>([0, HERO_AREA_SQFT_MAX]);
  const [floorLevels, setFloorLevels] = useState<FloorLevel[]>([]);
  const [hasToilet, setHasToilet] = useState(false);
  const [buildingAges, setBuildingAges] = useState<BuildingAge[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [heroUnitType, setHeroUnitType] = useState('any');

  const [unreadCount, setUnreadCount] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);
  const listingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const refreshUnread = async () => {
      const n = await fetchUnreadInquiryCount();
      if (!cancelled) setUnreadCount(n);
    };
    void refreshUnread();
    const interval = setInterval(refreshUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;
    const fetchProperties = async () => {
      const list = await loadHomepageProperties();
      if (isMounted) setProperties(list);
    };
    void fetchProperties();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFavorite = (id: string) => {
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)));
  };

  const moreFilterValues = useMemo<HeroMoreFiltersValues>(
    () => ({
      areaType: areaType === 'tube' ? 'tube' : areaType === 'school' ? 'school' : '',
      selectedTubeLine,
      selectedTubeStation,
      selectedSchoolNet,
      areaRange,
      floorLevels,
      buildingAges,
      hasPrivateToilet: hasToilet,
      amenities,
    }),
    [
      areaType,
      selectedTubeLine,
      selectedTubeStation,
      selectedSchoolNet,
      areaRange,
      floorLevels,
      buildingAges,
      hasToilet,
      amenities,
    ]
  );

  const advancedFilterCount = countActiveHeroMoreFilters(moreFilterValues);

  const handleMoreFiltersApply = (filters: HeroMoreFiltersValues) => {
    setAreaRange(filters.areaRange);
    setFloorLevels(filters.floorLevels);
    setBuildingAges(filters.buildingAges);
    setHasToilet(filters.hasPrivateToilet);
    setAmenities(filters.amenities);
    if (filters.areaType === 'tube' && (filters.selectedTubeLine || filters.selectedTubeStation)) {
      setAreaType('tube');
      setSelectedDistrict('');
      setSelectedTubeLine(filters.selectedTubeLine);
      setSelectedTubeStation(filters.selectedTubeStation);
      setSelectedSchoolNet('');
    } else if (filters.areaType === 'school' && filters.selectedSchoolNet) {
      setAreaType('school');
      setSelectedDistrict('');
      setSelectedTubeLine('');
      setSelectedTubeStation('');
      setSelectedSchoolNet(filters.selectedSchoolNet);
    } else if (filters.areaType === '') {
      if (areaType !== 'district') {
        setAreaType('district');
        setSelectedTubeLine('');
        setSelectedTubeStation('');
        setSelectedSchoolNet('');
      }
    }
    setActiveTab('home');
    listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const clearAdvancedFilters = () => {
    handleMoreFiltersApply(DEFAULT_HERO_MORE_FILTERS);
    if (areaType !== 'district') {
      setAreaType('district');
      setSelectedTubeLine('');
      setSelectedTubeStation('');
      setSelectedSchoolNet('');
    }
  };

  const matchesFloorLevels = (p: Property) => {
    if (floorLevels.length === 0) return true;
    return floorLevels.some((level) => {
      if (level === 'low') return p.floor >= 1 && p.floor <= 5;
      if (level === 'mid') return p.floor >= 6 && p.floor <= 15;
      if (level === 'high') return p.floor >= 16;
      return false;
    });
  };

  const matchesUnitType = (p: Property) => {
    if (heroUnitType === 'any') return true;
    if (heroUnitType === 'workshop') return textMatchesQuery(p.title, '工作室');
    if (heroUnitType === 'service') return textMatchesQuery(p.title, '服務式');
    if (heroUnitType === 'residential') {
      return !textMatchesQuery(p.title, '服務式') && !textMatchesQuery(p.title, '工作室');
    }
    return true;
  };

  const matchesTubeArea = (p: Property) => {
    if (areaType !== 'tube') return true;
    if (selectedTubeStation) return textMatchesQuery(p.title, selectedTubeStation);
    if (selectedTubeLine) {
      if (textMatchesQuery(p.title, selectedTubeLine)) return true;
      return getMtrStationsForLine(selectedTubeLine).some((station) => textMatchesQuery(p.title, station));
    }
    return true;
  };

  const matchesRoom = (p: Property) => {
    if (!roomFilter) return true;
    if (roomFilter === 'studio') return p.bedrooms === 0;
    if (roomFilter === '1') return p.bedrooms === 1;
    if (roomFilter === '2') return p.bedrooms === 2;
    if (roomFilter === '3+') return p.bedrooms >= 3;
    return true;
  };

  const filteredProperties = properties.filter((p) => {
    if (!textMatchesQuery(p.title, searchQuery)) return false;
    if (areaType === 'district' && selectedDistrict && !textMatchesQuery(p.title, selectedDistrict)) return false;
    if (!matchesTubeArea(p)) return false;
    if (areaType === 'school' && selectedSchoolNet && !textMatchesQuery(p.title, selectedSchoolNet)) return false;
    if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
    if (p.area < areaRange[0] || p.area > areaRange[1]) return false;
    if (!matchesFloorLevels(p)) return false;
    if (hasToilet && p.bathrooms < 1) return false;
    if (!matchesRoom(p)) return false;
    if (!matchesUnitType(p)) return false;
    return true;
  });

  const favoriteProperties = properties.filter((p) => p.isFavorite);
  const listings = activeTab === 'favorites' ? favoriteProperties : filteredProperties;

  const runHeroSearch = () => {
    setActiveTab('home');
    listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTop = () => {
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navIconBtnClass = (active: boolean) =>
    cn(
      'relative shrink-0 rounded-full border border-gray-200 bg-white p-2 text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:p-2.5',
      active && 'font-medium text-gray-900 ring-1 ring-gray-300'
    );

  const setPriceMin = (raw: string) => {
    const nextMin = parseHeroPriceInput(raw);
    setPriceRange(([_, max]) => [Math.min(nextMin, max), max]);
  };

  const setPriceMax = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const nextMax = digits ? clampHeroPrice(Number(digits)) : HERO_PRICE_MAX;
    setPriceRange(([min, _]) => [min, Math.max(nextMax, min)]);
  };

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-white">
      <header className="sticky top-0 z-50 shrink-0 border-b border-gray-200/80 bg-white/95 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-4 md:px-8 lg:px-10">
        <div className="flex min-h-14 items-center justify-between gap-2 py-2">
          <button
            type="button"
            onClick={scrollToTop}
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-1.5 py-1 pr-2.5 text-gray-900 shadow-sm transition-colors hover:bg-gray-50 sm:px-2 sm:py-1.5 sm:pr-3"
            aria-label={homeT.home}
          >
            <img src={thouseLogo} alt={homeT.brandName} className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
            <span className="hidden text-sm font-medium sm:inline md:text-base">{homeT.brandName}</span>
          </button>

          <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5 sm:gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('home');
                scrollToTop();
              }}
              className={navIconBtnClass(activeTab === 'home')}
              aria-label={homeT.home}
              aria-current={activeTab === 'home' ? 'page' : undefined}
            >
              <HomeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('favorites');
                listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={navIconBtnClass(activeTab === 'favorites')}
              aria-label={homeT.favorites}
              aria-current={activeTab === 'favorites' ? 'page' : undefined}
            >
              <Heart
                className={cn('h-4 w-4 sm:h-5 sm:w-5', activeTab === 'favorites' && 'fill-current')}
              />
            </button>
            <LanguageSwitcher variant="default" />
            <button
              type="button"
              onClick={() => setNoticeOpen(true)}
              className={navIconBtnClass(false)}
              aria-label={homeT.notice}
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1 sm:top-1 sm:h-2 sm:w-2" />
              )}
            </button>
            <button
              type="button"
              onClick={onChatClick}
              className={navIconBtnClass(false)}
              aria-label={homeT.chat}
            >
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-red-500 sm:right-1 sm:top-1 sm:h-2 sm:w-2" />
              )}
            </button>
            {isAuthenticated && userRole === 'tenant' ? (
              <button
                type="button"
                onClick={onMyPropertiesClick}
                className={navIconBtnClass(false)}
                aria-label={homeT.myRentals}
              >
                <House className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : null}
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => setRoleSelectOpen(true)}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 sm:px-3 sm:text-sm"
              >
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{homeT.login}</span>
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
                {userRole === 'landlord' && (
                  <button
                    type="button"
                    onClick={onLandlordDashboard}
                    className="max-w-[3.25rem] truncate rounded-full px-2 py-1.5 text-[11px] text-white shadow-sm transition-colors sm:max-w-none sm:px-3 sm:text-sm"
                    style={{ backgroundColor: NAVY }}
                  >
                    <span className="sm:hidden">{homeT.manage}</span>
                    <span className="hidden sm:inline">{homeT.manageCenter}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onProfileClick}
                  className="rounded-full border border-gray-200 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50 sm:p-2"
                  aria-label={homeT.profile}
                >
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主視覺：banner 約 40–55% 視高；搜尋白卡負 margin 往上疊，較大面積覆蓋在圖上 */}
      <div className="relative w-full min-w-0">
        <div className="relative h-[min(58vh,620px)] min-h-[360px] w-full max-h-[700px] overflow-hidden sm:min-h-[380px]">
          <img
            src="/thouse-banner.png"
            alt={homeT.bannerAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-black/20"
            aria-hidden
          />

          <div className="relative z-10 flex h-full min-h-0 flex-col">
          <div className="shrink-0 pb-1 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-3 sm:px-4 sm:pb-2 sm:pt-4 md:px-10 md:pt-5 lg:px-14">
            <div className="max-w-3xl">
              <h1
                className="text-[clamp(2.625rem,9.75vw,3.6rem)] font-bold leading-[1.15] drop-shadow-sm sm:text-[3.375rem] sm:leading-tight md:text-[3.375rem] md:leading-tight lg:text-[4.5rem]"
                style={{ color: NAVY }}
              >
                {homeT.heroTitle}
              </h1>
            </div>
          </div>
        </div>
        </div>

        <div className="relative z-20 w-full -mt-[clamp(10.5rem,44vw,22rem)] px-2 pb-2 sm:-mt-[clamp(5.5rem,16vw,11rem)] sm:px-4 md:px-6 lg:-mt-[clamp(6rem,14vw,12rem)]">
            {/* 白卡：手機用更大 -mt 讓白卡多壓在 banner 上；觸控區加高 */}
            <div className="mx-auto w-full max-w-7xl rounded-2xl border border-gray-200/90 bg-white p-3.5 shadow-lg sm:w-[min(100%,_96%)] sm:rounded-3xl sm:p-7 md:p-9 md:shadow-[0_12px_40px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)]">
                {/* 關鍵字列：手機直向堆疊；手機欄高加大利於觸控 */}
                <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex h-14 w-full min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-gray-200 bg-gray-50/60 px-3 shadow-sm ring-1 ring-gray-200/60 sm:h-auto sm:min-h-0 sm:rounded-full sm:px-5 sm:py-3.5">
                    <Search className="h-5 w-5 shrink-0 text-gray-400 sm:h-[18px] sm:w-[18px]" />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runHeroSearch()}
                      placeholder={homeT.searchPlaceholder}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-gray-800 placeholder:text-gray-400 shadow-none focus-visible:ring-0 sm:min-h-[2.5rem] sm:text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={runHeroSearch}
                    className="!h-14 w-full min-h-14 shrink-0 rounded-2xl border-0 px-6 !py-3 text-base font-medium text-white shadow-sm transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#1a365d] focus-visible:ring-offset-2 sm:!h-12 sm:min-h-12 sm:rounded-full sm:!py-2.5 sm:text-sm sm:w-auto sm:px-8"
                    style={{ backgroundColor: NAVY }}
                  >
                    {homeT.search}
                  </Button>
                </div>

                <div className="my-4 border-t border-gray-100 sm:my-5 md:my-6" role="separator" aria-hidden />

                {/* 手機：直向堆疊全寬；lg+ 橫向捲動與欄間分隔線（與參考桌面稿一致） */}
                <div className="flex w-full min-w-0 flex-col gap-4 md:flex-nowrap md:flex-row md:items-stretch md:gap-0 md:overflow-x-auto md:[-ms-overflow-style:none] md:[scrollbar-width:none] [&::-webkit-scrollbar]:md:hidden">
                  <div className="flex w-full min-w-0 flex-col gap-2 md:min-w-[7.5rem] md:max-w-[200px] md:shrink-0 md:pr-3">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      {homeT.district}
                    </Label>
                    <Select
                      value={selectedDistrict || 'any'}
                      onValueChange={(v) => {
                        setSelectedDistrict(v === 'any' ? '' : v);
                        setAreaType('district');
                        setSelectedTubeLine('');
                        setSelectedTubeStation('');
                        setSelectedSchoolNet('');
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 shadow-sm focus:ring-1 focus:ring-gray-300">
                        <SelectValue placeholder={homeT.anyDistrict} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{homeT.anyDistrict}</SelectItem>
                        {HK_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div aria-hidden className="my-1 hidden w-px shrink-0 self-stretch bg-gray-200 md:block" />

                  <div className="flex w-full min-w-0 flex-1 flex-col gap-2 px-0 md:min-w-[200px] md:px-3 lg:min-w-[240px] lg:px-4">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      {homeT.rentRange}
                    </Label>
                    <div className="pt-0.5">
                      <div
                        className="mb-2 flex min-h-[2.5rem] flex-wrap items-center gap-2 rounded-lg border border-gray-200/80 bg-slate-50/90 px-2.5 py-2 sm:gap-2.5 sm:px-3"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="shrink-0 text-xs text-gray-600">{homeT.minRent}</span>
                          <div className="relative min-w-0 flex-1">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              HK$
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              aria-label={homeT.minRent}
                              value={priceRange[0] === 0 ? '' : String(priceRange[0])}
                              placeholder="0"
                              onChange={(e) => setPriceMin(e.target.value)}
                              onBlur={() => setPriceRange(([min, max]) => [clampHeroPrice(min), max])}
                              className="h-9 border-gray-200 bg-white pl-9 pr-2 text-sm tabular-nums shadow-sm focus-visible:ring-1 focus-visible:ring-gray-300"
                            />
                          </div>
                        </label>
                        <span className="shrink-0 text-gray-300" aria-hidden>
                          |
                        </span>
                        <label className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="shrink-0 text-xs text-gray-600">{homeT.maxRent}</span>
                          <div className="relative min-w-0 flex-1">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              HK$
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              aria-label={homeT.maxRent}
                              value={String(priceRange[1])}
                              onChange={(e) => setPriceMax(e.target.value)}
                              onBlur={() =>
                                setPriceRange(([min, max]) => [min, Math.max(clampHeroPrice(max), min)])
                              }
                              className="h-9 border-gray-200 bg-white pl-9 pr-2 text-sm tabular-nums shadow-sm focus-visible:ring-1 focus-visible:ring-gray-300"
                            />
                          </div>
                        </label>
                      </div>
                      <Slider
                        value={priceRange}
                        onValueChange={(v) => setPriceRange(v as [number, number])}
                        min={0}
                        max={HERO_PRICE_MAX}
                        step={200}
                        className="w-full touch-manipulation"
                        rangeStyle={{ backgroundColor: NAVY }}
                        thumbStyle={{
                          backgroundColor: NAVY,
                          borderColor: NAVY,
                          borderWidth: 2,
                          width: 20,
                          height: 20,
                        }}
                      />
                    </div>
                  </div>

                  <div aria-hidden className="my-1 hidden w-px shrink-0 self-stretch bg-gray-200 md:block" />

                  <div className="flex w-full min-w-0 flex-col gap-2 px-0 sm:max-w-sm md:w-[6.5rem] md:min-w-[5.5rem] md:shrink-0 md:px-2">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      {homeT.unitType}
                    </Label>
                    <Select value={heroUnitType} onValueChange={setHeroUnitType}>
                      <SelectTrigger className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 shadow-sm focus:ring-1 focus:ring-gray-300">
                        <SelectValue placeholder={homeT.any} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{homeT.any}</SelectItem>
                        <SelectItem value="residential">{homeT.residential}</SelectItem>
                        <SelectItem value="service">{homeT.serviceApartment}</SelectItem>
                        <SelectItem value="workshop">{homeT.workshop}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div aria-hidden className="my-1 hidden w-px shrink-0 self-stretch bg-gray-200 md:block" />

                  <div className="flex w-full min-w-0 flex-col gap-2 px-0 sm:max-w-sm md:min-w-[8.5rem] md:shrink-0 md:px-3">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      {homeT.bedrooms}
                    </Label>
                    <Select value={roomFilter || 'any'} onValueChange={(v) => setRoomFilter(v === 'any' ? '' : v)}>
                      <SelectTrigger className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 shadow-sm focus:ring-1 focus:ring-gray-300">
                        <SelectValue placeholder={homeT.anyBedrooms} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{homeT.anyBedrooms}</SelectItem>
                        <SelectItem value="studio">{homeT.studio}</SelectItem>
                        <SelectItem value="1">{homeT.oneBed}</SelectItem>
                        <SelectItem value="2">{homeT.twoBed}</SelectItem>
                        <SelectItem value="3+">{homeT.threePlusBed}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSearchDialogOpen(true)}
                        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
                        aria-label={
                          advancedFilterCount > 0
                            ? homeT.format('moreFiltersWithCount', { count: advancedFilterCount })
                            : homeT.moreFilters
                        }
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" style={{ color: NAVY }} />
                        <span>{homeT.moreFilters}</span>
                        {advancedFilterCount > 0 ? (
                          <span
                            className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                            style={{ backgroundColor: NAVY }}
                          >
                            {advancedFilterCount}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>
                </div>

                {advancedFilterCount > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                    <span className="text-xs font-medium text-gray-500">{homeT.advancedFilters}</span>
                    {moreFilterValues.areaType === 'tube' && moreFilterValues.selectedTubeLine ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-gray-800">
                        {homeT.tube}：{moreFilterValues.selectedTubeLine}
                        {moreFilterValues.selectedTubeStation ? ` · ${moreFilterValues.selectedTubeStation}` : ''}
                      </span>
                    ) : null}
                    {moreFilterValues.areaType === 'school' && moreFilterValues.selectedSchoolNet ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-gray-800">
                        {homeT.schoolNet}：{moreFilterValues.selectedSchoolNet}
                      </span>
                    ) : null}
                    {(moreFilterValues.areaRange[0] > 0 || moreFilterValues.areaRange[1] < HERO_AREA_SQFT_MAX) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-gray-800">
                        {moreFilterValues.areaRange[0]}–{moreFilterValues.areaRange[1]}
                        {moreFilterValues.areaRange[1] >= HERO_AREA_SQFT_MAX ? '+' : ''} {homeT.sqft}
                      </span>
                    )}
                    {moreFilterValues.floorLevels.map((level) => (
                      <span
                        key={level}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-gray-800"
                      >
                        {level === 'low' ? homeT.lowFloor : level === 'mid' ? homeT.midFloor : homeT.highFloor}
                      </span>
                    ))}
                    {moreFilterValues.buildingAges.map((age) => (
                      <span
                        key={age}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-gray-800"
                      >
                        {age === 'new'
                          ? commonT.buildingAgeNew
                          : age === '5-10'
                            ? commonT.buildingAge5_10
                            : age === '10-20'
                              ? commonT.buildingAge10_20
                              : commonT.buildingAge20Plus}
                      </span>
                    ))}
                    {moreFilterValues.hasPrivateToilet ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-gray-800">
                        {homeT.privateBathroom}
                      </span>
                    ) : null}
                    {moreFilterValues.amenities.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-gray-800"
                      >
                        {a}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={clearAdvancedFilters}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800"
                    >
                      <X className="h-3 w-3" />
                      {homeT.clearAdvanced}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
      </div>

      <div
        ref={listingsRef}
        id="listings"
        className="mx-auto w-full max-w-[1360px] px-4 pb-10 pt-6 md:px-12 md:pb-12 md:pt-10 lg:px-16 lg:pb-14"
      >
        <div className="mb-4 flex flex-col gap-1.5 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-lg sm:text-xl" style={{ color: NAVY }}>
            {activeTab === 'favorites' ? homeT.myFavorites : homeT.recommended}
          </h2>
          <span className="shrink-0 text-sm text-gray-500">{homeT.format('results', { count: listings.length })}</span>
        </div>

        {listings.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            {activeTab === 'favorites'
              ? homeT.noFavorites
              : properties.length === 0
                ? homeT.noListings
                : homeT.noMatches}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12"
            role="list"
            aria-label={homeT.listings}
          >
            {/* 手機 1 欄、平板 2 欄（sm+）、桌面 3 欄（lg+） */}
            {listings.map((property) => (
              <div key={property.id} className="min-w-0 max-w-full" role="listitem">
                <PropertyCard
                  property={property}
                  onToggleFavorite={toggleFavorite}
                  onClick={() => onPropertyClick(property)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <ThouseHomeFooter className="mt-auto" />

      <HeroMoreFiltersDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        values={moreFilterValues}
        onApply={handleMoreFiltersApply}
      />

      <NoticeDialog
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        userRole={userRole === 'landlord' ? 'landlord' : 'tenant'}
        onOpenChat={onChatClick}
      />

      <Dialog open={roleSelectOpen} onOpenChange={setRoleSelectOpen}>
        <DialogContent className="mx-auto max-w-md">
          <DialogHeader>
            <DialogTitle>{homeT.chooseRole}</DialogTitle>
            <DialogDescription>{homeT.chooseRoleHint}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              className="w-full text-white"
              style={{ backgroundColor: NAVY }}
              onClick={() => {
                onAuthClick('tenant');
                setRoleSelectOpen(false);
              }}
            >
              {homeT.tenant}
            </Button>
            <Button
              className="w-full text-white"
              style={{ backgroundColor: NAVY }}
              onClick={() => {
                onAuthClick('landlord');
                setRoleSelectOpen(false);
              }}
            >
              {homeT.landlord}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
