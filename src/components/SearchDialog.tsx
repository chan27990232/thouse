import { useState } from 'react';

const SEARCH_PRICE_MAX = 80000;
import { Search, Home, DollarSign, Maximize2, Building, Layers, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (criteria: SearchCriteria) => void;
}

export interface SearchCriteria {
  location: string;
  areaType: 'district' | 'tube' | 'school';
  selectedArea: string;
  priceMin: number;
  priceMax: number;
  areaMin: number;
  areaMax: number;
  bedrooms: number | null;
  bathrooms: number | null;
  floorLevel: 'low' | 'mid' | 'high' | '';
  buildingAge: 'new' | '5-10' | '10-20' | '20+' | '';
  hasPrivateToilet: boolean;
  amenities: string[];
}

export function SearchDialog({ open, onOpenChange, onSearch }: SearchDialogProps) {
  const [location, setLocation] = useState('');
  const [areaType, setAreaType] = useState<'district' | 'tube' | 'school'>('district');
  const [selectedArea, setSelectedArea] = useState('');
  const [priceRange, setPriceRange] = useState([0, SEARCH_PRICE_MAX]);
  const [areaRange, setAreaRange] = useState([0, 200]);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [bathrooms, setBathrooms] = useState<number | null>(null);
  const [floorLevel, setFloorLevel] = useState<'low' | 'mid' | 'high' | ''>('');
  const [buildingAge, setBuildingAge] = useState<'new' | '5-10' | '10-20' | '20+' | ''>('');
  const [hasPrivateToilet, setHasPrivateToilet] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);

  const districts = ['油麻地', '荃灣', '旺角', '尖沙咀', '銅鑼灣', '灣仔', '中環', '九龍塘', '沙田', '大埔'];
  const tubeLines = ['港島線', '荃灣線', '觀塘線', '東涌線', '將軍澳線', '屯馬線'];
  const schools = ['拔萃女書院', '喇沙書院', '聖保羅男女中學', '華仁書院', '真光女書院'];
  const amenitiesList = ['停車場', '健身房', '游泳池', '24小時保安', '會所', '花園'];

  const handleSearch = () => {
    onSearch({
      location,
      areaType,
      selectedArea,
      priceMin: priceRange[0],
      priceMax: priceRange[1],
      areaMin: areaRange[0],
      areaMax: areaRange[1],
      bedrooms,
      bathrooms,
      floorLevel,
      buildingAge,
      hasPrivateToilet,
      amenities,
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocation('');
    setAreaType('district');
    setSelectedArea('');
    setPriceRange([0, SEARCH_PRICE_MAX]);
    setAreaRange([0, 200]);
    setBedrooms(null);
    setBathrooms(null);
    setFloorLevel('');
    setBuildingAge('');
    setHasPrivateToilet(false);
    setAmenities([]);
  };

  const toggleAmenity = (amenity: string) => {
    setAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            搜尋物業
          </DialogTitle>
          <DialogDescription>
            請輸入您的搜尋條件，我們將為您篩選合適的物業。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Location Search */}
          <div className="space-y-2">
            <Label>地點 / 物業名稱</Label>
            <Input
              placeholder="輸入地址或物業名稱"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Area Type Selection */}
          <div className="space-y-3">
            <Label>區域選擇方式</Label>
            <RadioGroup value={areaType} onValueChange={(v) => setAreaType(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="district" id="search-district" />
                <Label htmlFor="search-district">按地區</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tube" id="search-tube" />
                <Label htmlFor="search-tube">按地鐵線</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="school" id="search-school" />
                <Label htmlFor="search-school">按校網</Label>
              </div>
            </RadioGroup>

            {/* Area Selection Dropdown */}
            {areaType === 'district' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {districts.map(district => (
                  <button
                    key={district}
                    onClick={() => setSelectedArea(selectedArea === district ? '' : district)}
                    className={`p-2 border rounded text-sm transition-colors ${
                      selectedArea === district 
                        ? 'bg-black text-white border-black' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {district}
                  </button>
                ))}
              </div>
            )}

            {areaType === 'tube' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {tubeLines.map(line => (
                  <button
                    key={line}
                    onClick={() => setSelectedArea(selectedArea === line ? '' : line)}
                    className={`p-2 border rounded text-sm transition-colors ${
                      selectedArea === line 
                        ? 'bg-black text-white border-black' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {line}
                  </button>
                ))}
              </div>
            )}

            {areaType === 'school' && (
              <div className="grid grid-cols-1 gap-2 mt-2">
                {schools.map(school => (
                  <button
                    key={school}
                    onClick={() => setSelectedArea(selectedArea === school ? '' : school)}
                    className={`p-2 border rounded text-sm transition-colors ${
                      selectedArea === school 
                        ? 'bg-black text-white border-black' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {school}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              租金範圍（HK$ 0 – {SEARCH_PRICE_MAX.toLocaleString('en-HK')}）
            </Label>
            <p
              className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm font-medium tabular-nums text-gray-900"
              aria-live="polite"
              aria-atomic="true"
            >
              <span>最低 HK$ {priceRange[0].toLocaleString('en-HK')}</span>
              <span className="text-gray-300">|</span>
              <span>
                最高 HK$ {priceRange[1].toLocaleString('en-HK')}
                {priceRange[1] >= SEARCH_PRICE_MAX ? '+' : ''}
              </span>
            </p>
            <div className="px-2">
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                min={0}
                max={SEARCH_PRICE_MAX}
                step={200}
                className="touch-manipulation"
              />
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>HK$ 0</span>
                <span>HK$ {SEARCH_PRICE_MAX.toLocaleString('en-HK')}+</span>
              </div>
            </div>
          </div>

          {/* Area Range */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              面積範圍 (平方呎)
            </Label>
            <div className="px-2">
              <Slider
                value={areaRange}
                onValueChange={setAreaRange}
                min={0}
                max={2000}
                step={50}
              />
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>{areaRange[0]} 呎</span>
                <span>{areaRange[1]} 呎</span>
              </div>
            </div>
          </div>

          {/* Floor Level */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              樓層
            </Label>
            <RadioGroup value={floorLevel} onValueChange={(v) => setFloorLevel(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="search-floor-low" />
                <Label htmlFor="search-floor-low">低層 (1-5樓)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mid" id="search-floor-mid" />
                <Label htmlFor="search-floor-mid">中層 (6-15樓)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="search-floor-high" />
                <Label htmlFor="search-floor-high">高層 (16樓以上)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Building Age */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              樓齡
            </Label>
            <RadioGroup value={buildingAge} onValueChange={(v) => setBuildingAge(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="search-age-new" />
                <Label htmlFor="search-age-new">5年以下</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="5-10" id="search-age-5-10" />
                <Label htmlFor="search-age-5-10">5-10年</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="10-20" id="search-age-10-20" />
                <Label htmlFor="search-age-10-20">10-20年</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="20+" id="search-age-20+" />
                <Label htmlFor="search-age-20+">20年以上</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Private Toilet */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="search-toilet" 
              checked={hasPrivateToilet}
              onCheckedChange={(checked) => setHasPrivateToilet(checked as boolean)}
            />
            <Label htmlFor="search-toilet">獨立洗手間</Label>
          </div>

          {/* Amenities */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              設施
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {amenitiesList.map(amenity => (
                <div key={amenity} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`amenity-${amenity}`}
                    checked={amenities.includes(amenity)}
                    onCheckedChange={() => toggleAmenity(amenity)}
                  />
                  <Label htmlFor={`amenity-${amenity}`} className="cursor-pointer">
                    {amenity}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              重設
            </Button>
            <Button onClick={handleSearch} className="flex-1 bg-black text-white hover:bg-gray-800">
              搜尋
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}