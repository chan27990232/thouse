import { useEffect, useState } from 'react';
import { Search, Bell, MessageCircle, User } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import { Property } from '../App';
import { Input } from './ui/input';
import { SearchDialog, SearchCriteria } from './SearchDialog';
import { NoticeDialog } from './NoticeDialog';
import { loadHomepageProperties } from '../lib/properties';
import { fetchUnreadInquiryCount } from '../lib/conversations';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { ThouseHomeFooter } from './ThouseHomeFooter';

interface TenantHomeProps {
  onSignOut: () => void;
  onPropertyClick: (property: Property) => void;
  onChatClick: () => void;
  onProfileClick: () => void;
}

export function TenantHome({ onSignOut, onPropertyClick, onChatClick, onProfileClick }: TenantHomeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [areaType, setAreaType] = useState<'district' | 'tube' | 'school'>('district');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedTubeLine, setSelectedTubeLine] = useState<string>('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  /** 與 `Home` 首頁相同預設，避免租客端一進頁就看不到已核准的高租金／大面積盤 */
  const [priceRange, setPriceRange] = useState([0, 100000]);
  const [areaRange, setAreaRange] = useState([0, 10000]);
  const [floorLevel, setFloorLevel] = useState<string>('');
  const [hasToilet, setHasToilet] = useState(false);
  const [buildingAge, setBuildingAge] = useState<string>('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchProperties = async () => {
      const list = await loadHomepageProperties();
      if (isMounted) {
        setProperties(list);
      }
    };

    fetchProperties();

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
    return true;
  });

  const favoriteProperties = properties.filter((p) => p.isFavorite);
  const listings = activeTab === 'favorites' ? favoriteProperties : filteredProperties;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="relative w-full min-w-0">
      <div className="relative">
        <img src="/thouse-banner.png" alt="T-House banner" className="w-full h-auto" />

        <div className="absolute top-4 left-0 right-0 px-4 md:px-8 lg:px-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <img src={thouseLogo} alt="簡屋" className="w-8 h-8 md:w-9 md:h-9" />
                <span className="text-sm md:text-base tracking-wider">簡屋</span>
              </div>
              <button
                onClick={() => setActiveTab('home')}
                className={`text-sm md:text-base ${activeTab === 'home' ? 'text-black font-medium' : 'text-gray-600'}`}
              >
                首頁
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`text-sm md:text-base ${activeTab === 'favorites' ? 'text-black font-medium' : 'text-gray-600'}`}
              >
                最愛
              </button>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => setNoticeOpen(true)}
                className="relative p-2 rounded-full bg-white/85 hover:bg-white"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
              </button>
              <button
                onClick={onChatClick}
                className="relative p-2 rounded-full bg-white/85 hover:bg-white"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
              </button>
              <button
                onClick={onProfileClick}
                className="p-2 rounded-full bg-white/85 hover:bg-white"
                aria-label="個人資料"
              >
                <User className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 bottom-[24%] md:bottom-[22%] w-[min(92%,760px)]">
          <div className="h-12 md:h-14 bg-white/95 rounded-full shadow-lg border border-gray-200 flex items-center px-3 md:px-4">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋地區 / 物業名稱"
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-full bg-transparent"
            />
            <button
              onClick={() => setSearchDialogOpen(true)}
              className="h-9 px-4 rounded-full bg-black text-white text-sm hover:bg-gray-800"
            >
              篩選
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-5 md:px-12 lg:px-16 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl">{activeTab === 'favorites' ? '我的最愛' : '推薦租盤'}</h2>
          <span className="text-sm text-gray-500">{listings.length} 個結果</span>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {activeTab === 'favorites' ? '尚未收藏租盤' : '找不到符合條件的租盤'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-12 gap-y-12">
            {listings.map((property) => (
              <div key={property.id} className="px-2 flex justify-center">
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
      </div>

      <ThouseHomeFooter className="mt-auto" />

      <SearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} onSearch={handleSearchCriteria} />
      <NoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} userRole="tenant" />
    </div>
  );
}
