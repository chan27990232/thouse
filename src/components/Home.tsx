import { useEffect, useRef, useState } from 'react';
import { Search, Bell, MessageCircle, User, SlidersHorizontal } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import { Property, UserRole } from '../App';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { SearchDialog, SearchCriteria } from './SearchDialog';
import { NoticeDialog } from './NoticeDialog';
import { loadHomepageProperties } from '../lib/properties';
import { fetchUnreadInquiryCount } from '../lib/conversations';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { ThouseHomeFooter } from './ThouseHomeFooter';

/** Design mockup: deep navy for primary text, CTA, slider */
const NAVY = '#1a365d' as const;

/** 首頁英雄區租金雙向滑桿：0 – 80,000（與搜尋彈窗一致） */
const HERO_PRICE_MAX = 80000;

const HK_DISTRICTS = [
  '油麻地',
  '荃灣',
  '旺角',
  '尖沙咀',
  '銅鑼灣',
  '灣仔',
  '中環',
  '九龍塘',
  '沙田',
  '大埔',
] as const;

interface HomeProps {
  onAuthClick: (role: 'tenant' | 'landlord') => void;
  isAuthenticated: boolean;
  userRole: UserRole;
  onSignOut: () => void;
  onPropertyClick: (property: Property) => void;
  onLandlordDashboard: () => void;
  onChatClick: () => void;
  onProfileClick: () => void;
}

export function Home({
  onAuthClick,
  isAuthenticated,
  userRole,
  onPropertyClick,
  onLandlordDashboard,
  onChatClick,
  onProfileClick,
}: HomeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const [areaType, setAreaType] = useState<'district' | 'tube' | 'school'>('district');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedTubeLine, setSelectedTubeLine] = useState<string>('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [priceRange, setPriceRange] = useState([0, HERO_PRICE_MAX]);
  const [areaRange, setAreaRange] = useState([0, 10000]);
  const [floorLevel, setFloorLevel] = useState<string>('');
  const [hasToilet, setHasToilet] = useState(false);
  const [buildingAge, setBuildingAge] = useState<string>('');
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

  const handleSearchCriteria = (criteria: SearchCriteria) => {
    setSearchQuery(criteria.location);
    setAreaType(criteria.areaType);
    setSelectedDistrict(criteria.areaType === 'district' ? criteria.selectedArea : '');
    setSelectedTubeLine(criteria.areaType === 'tube' ? criteria.selectedArea : '');
    setSelectedSchool(criteria.areaType === 'school' ? criteria.selectedArea : '');
    setPriceRange([
      Math.min(200000, Math.max(0, criteria.priceMin)),
      Math.min(200000, Math.max(0, criteria.priceMax)),
    ]);
    setAreaRange([criteria.areaMin, criteria.areaMax]);
    setFloorLevel(criteria.floorLevel);
    setBuildingAge(criteria.buildingAge);
    setHasToilet(criteria.hasPrivateToilet);
    setAmenities(criteria.amenities);
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
    const q = searchQuery.trim().toLowerCase();
    if (q && !p.title.toLowerCase().includes(q)) return false;
    if (areaType === 'district' && selectedDistrict && !p.title.includes(selectedDistrict)) return false;
    if (areaType === 'tube' && selectedTubeLine && !p.title.includes(selectedTubeLine)) return false;
    if (areaType === 'school' && selectedSchool && !p.title.includes(selectedSchool)) return false;
    if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
    if (p.area < areaRange[0] || p.area > areaRange[1]) return false;
    if (floorLevel === 'low' && (p.floor < 1 || p.floor > 5)) return false;
    if (floorLevel === 'mid' && (p.floor < 6 || p.floor > 15)) return false;
    if (floorLevel === 'high' && p.floor < 16) return false;
    if (hasToilet && p.bathrooms < 1) return false;
    if (!matchesRoom(p)) return false;
    return true;
  });

  const favoriteProperties = properties.filter((p) => p.isFavorite);
  const listings = activeTab === 'favorites' ? favoriteProperties : filteredProperties;

  const runHeroSearch = () => {
    setActiveTab('home');
    listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* 主視覺：banner 約 40–50% 視高；搜尋卡以負 margin 疊在下緣，半在圖、半在下方白底 */}
      <div className="relative w-full min-w-0">
        <div className="relative h-[min(50vh,560px)] min-h-[300px] w-full max-h-[640px] overflow-hidden sm:min-h-[360px]">
          <img
            src="/thouse-banner.png"
            alt="簡約明亮客廳空間，淺色牆面與木儲物櫃"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-black/20"
            aria-hidden
          />

          <div className="relative z-10 flex h-full min-h-0 flex-col">
          <header className="shrink-0 px-4 pt-4 md:px-8 md:pt-5 lg:px-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 md:gap-4">
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/80 bg-white px-2 py-1.5 pr-3 text-gray-900 shadow-sm">
                  <img src={thouseLogo} alt="簡屋" className="h-8 w-8 shrink-0 md:h-9 md:w-9" />
                  <span className="text-sm font-medium md:text-base">簡屋</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('home')}
                    className={`rounded-full border border-white/80 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm md:text-base ${activeTab === 'home' ? 'font-medium ring-1 ring-gray-300' : 'font-normal ring-0 hover:bg-gray-50'}`}
                  >
                    首頁
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('favorites')}
                    className={`rounded-full border border-white/80 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm md:text-base ${activeTab === 'favorites' ? 'font-medium ring-1 ring-gray-300' : 'font-normal ring-0 hover:bg-gray-50'}`}
                  >
                    最愛
                  </button>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={() => setNoticeOpen(true)}
                  className="relative rounded-full border border-white/80 bg-white p-2 text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
                  aria-label="通知"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
                </button>
                <button
                  type="button"
                  onClick={onChatClick}
                  className="relative rounded-full border border-white/80 bg-white p-2 text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
                  aria-label="聊天"
                >
                  <MessageCircle className="h-5 w-5" />
                  {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
                </button>
                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => setRoleSelectOpen(true)}
                    className="flex items-center gap-1 rounded-full border border-white/80 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
                  >
                    <User className="h-4 w-4" />
                    登入
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {userRole === 'landlord' && (
                      <button
                        type="button"
                        onClick={onLandlordDashboard}
                        className="rounded-full px-3 py-1.5 text-sm text-white shadow-sm transition-colors"
                        style={{ backgroundColor: NAVY }}
                      >
                        管理中心
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onProfileClick}
                      className="rounded-full bg-white/95 p-2 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white"
                      aria-label="個人資料"
                    >
                      <User className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="shrink-0 px-4 pb-2 pt-2 md:px-10 md:pt-4 lg:px-14">
            <div className="max-w-2xl">
              <h1
                className="text-3xl font-bold leading-tight drop-shadow-sm md:text-4xl md:leading-tight lg:text-5xl"
                style={{ color: NAVY }}
              >
                簡屋 · 揀好屋
              </h1>
            </div>
          </div>
        </div>
        </div>

        <div className="relative z-20 w-full -mt-[clamp(3.5rem,11vw,7.5rem)] px-3 pb-2 sm:px-5 md:px-6">
            {/* 白卡：寬約 80–88%、半疊在 banner 上；陰影與圓角對齊參考稿 */}
            <div className="mx-auto w-full max-w-6xl rounded-2xl border border-gray-200/90 bg-white p-6 shadow-lg sm:w-[min(100%,_88%)] sm:p-7 md:p-8 md:shadow-[0_12px_40px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)]">
                {/* 上列：關鍵字與搜尋鈕分開，中留間隙；鈕為圓頭膠囊 */}
                <div className="flex w-full min-w-0 flex-row items-center gap-3 sm:gap-4">
                  <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-gray-200 bg-gray-50/60 px-4 py-2.5 shadow-sm ring-1 ring-gray-200/60">
                    <Search className="h-[18px] w-[18px] shrink-0 text-gray-400" />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runHeroSearch()}
                      placeholder="輸入地區、屋苑或關鍵字"
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gray-800 placeholder:text-gray-400 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={runHeroSearch}
                    className="!h-auto shrink-0 rounded-full border-0 px-6 !py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#1a365d] focus-visible:ring-offset-2"
                    style={{ backgroundColor: NAVY }}
                  >
                    搜尋
                  </Button>
                </div>

                <div className="my-5 border-t border-gray-100 sm:my-6" role="separator" aria-hidden />

                {/* 下排：單一橫列 + 欄間淺灰直線；窄螢幕可橫向捲動 */}
                <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:items-end [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-[7.5rem] max-w-[200px] shrink-0 flex-col gap-2 pr-3 sm:min-w-[8.5rem] sm:pr-4">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      地區
                    </Label>
                    <Select
                      value={selectedDistrict || 'any'}
                      onValueChange={(v) => {
                        setSelectedDistrict(v === 'any' ? '' : v);
                        setAreaType('district');
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 shadow-sm focus:ring-1 focus:ring-gray-300">
                        <SelectValue placeholder="不限地區" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">不限地區</SelectItem>
                        {HK_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div aria-hidden className="my-1 w-px shrink-0 self-stretch bg-gray-200" />

                  <div className="flex min-w-[200px] flex-1 flex-col gap-2 px-3 sm:min-w-[240px] sm:px-4">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      租金範圍 (HK$ / 月)
                    </Label>
                    <div className="pt-0.5">
                      <p
                        className="mb-2 flex min-h-[2.5rem] flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200/80 bg-slate-50/90 px-3 py-2 text-sm tabular-nums text-gray-800"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        <span>
                          最低{' '}
                          <strong className="font-semibold" style={{ color: NAVY }}>
                            HK$ {priceRange[0].toLocaleString('en-HK')}
                          </strong>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>
                          最高{' '}
                          <strong className="font-semibold" style={{ color: NAVY }}>
                            HK$ {priceRange[1].toLocaleString('en-HK')}
                            {priceRange[1] >= HERO_PRICE_MAX ? '+' : ''}
                          </strong>
                        </span>
                      </p>
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

                  <div aria-hidden className="my-1 w-px shrink-0 self-stretch bg-gray-200" />

                  <div className="flex w-[min(100%,7.5rem)] min-w-[5.5rem] shrink-0 flex-col gap-2 px-2 sm:w-[6.5rem] sm:min-w-[6.5rem] sm:px-3">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      單位類型
                    </Label>
                    <Select value={heroUnitType} onValueChange={setHeroUnitType}>
                      <SelectTrigger className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 shadow-sm focus:ring-1 focus:ring-gray-300">
                        <SelectValue placeholder="不限" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">不限</SelectItem>
                        <SelectItem value="residential">住宅</SelectItem>
                        <SelectItem value="service">服務式住宅</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div aria-hidden className="my-1 w-px shrink-0 self-stretch bg-gray-200" />

                  <div className="flex min-w-[6.5rem] shrink-0 flex-col gap-2 px-2 sm:min-w-[7.5rem] sm:px-3">
                    <Label className="block text-left text-xs font-medium leading-none" style={{ color: '#4a5568' }}>
                      房間數目
                    </Label>
                    <Select value={roomFilter || 'any'} onValueChange={(v) => setRoomFilter(v === 'any' ? '' : v)}>
                      <SelectTrigger className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 shadow-sm focus:ring-1 focus:ring-gray-300">
                        <SelectValue placeholder="不限房間數" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">不限房間數</SelectItem>
                        <SelectItem value="studio">開放式</SelectItem>
                        <SelectItem value="1">1 房</SelectItem>
                        <SelectItem value="2">2 房</SelectItem>
                        <SelectItem value="3+">3 房或以上</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div aria-hidden className="my-1 w-px shrink-0 self-stretch bg-gray-200" />

                  <div className="flex min-w-[5.5rem] flex-1 items-center justify-end pl-1 pr-0 sm:min-w-0 sm:pl-2 sm:pr-1">
                    <button
                      type="button"
                      onClick={() => setSearchDialogOpen(true)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-blue-600 transition-opacity hover:opacity-80"
                    >
                      <span>更多篩選</span>
                      <SlidersHorizontal className="h-4 w-4 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
      </div>

      <div
        ref={listingsRef}
        id="listings"
        className="mx-auto w-full max-w-[1360px] px-4 pb-10 pt-6 md:px-12 md:pb-12 md:pt-10 lg:px-16 lg:pb-14"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl" style={{ color: NAVY }}>
            {activeTab === 'favorites' ? '我的最愛' : '推薦租盤'}
          </h2>
          <span className="text-sm text-gray-500">{listings.length} 個結果</span>
        </div>

        {listings.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            {activeTab === 'favorites'
              ? '尚未收藏租盤'
              : properties.length === 0
                ? '暫時沒有租盤，請稍後再試。'
                : '找不到符合條件的租盤，可試試清空關鍵字或放寬租金／篩選。'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-12 gap-y-12">
            {listings.map((property) => (
              <div key={property.id} className="flex justify-center px-2">
                <div className="w-[70%]">
                  <PropertyCard
                    property={property}
                    onToggleFavorite={toggleFavorite}
                    onClick={() => onPropertyClick(property)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ThouseHomeFooter className="mt-auto" />

      <SearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} onSearch={handleSearchCriteria} />

      <NoticeDialog
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        userRole={userRole === 'landlord' ? 'landlord' : 'tenant'}
      />

      <Dialog open={roleSelectOpen} onOpenChange={setRoleSelectOpen}>
        <DialogContent className="mx-auto max-w-md">
          <DialogHeader>
            <DialogTitle>選擇身份</DialogTitle>
            <DialogDescription>請選擇您的身份以繼續</DialogDescription>
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
              租客
            </Button>
            <Button
              className="w-full text-white"
              style={{ backgroundColor: NAVY }}
              onClick={() => {
                onAuthClick('landlord');
                setRoleSelectOpen(false);
              }}
            >
              業主
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
