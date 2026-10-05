import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { LocalizedFileInput } from './ui/LocalizedFileInput';
import { useLocale } from '../context/LocaleContext';
import { getListingPropertyTypes, type ListingPropertyTypeId } from '../content/translations/listProperty';
import { HK_DISTRICTS } from '../lib/hkDistricts';
import { buildListingDescription, LISTING_PROPERTY_TYPES } from '../lib/listPropertyOptions';
import { buildingAgeFromBuiltYear, parsePropertyYear } from '../lib/propertyFilterFields';
import { uploadListingCoverImage, uploadListingPublicImage, uploadProofPhotoFiles } from '../lib/propertyMediaUpload';
import { supabase } from '../lib/supabase';
import { cn } from './ui/utils';

type EditListingMediaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landlordId: string;
  propertyId: string;
  propertyTitle: string;
  onSuccess: () => void | Promise<void>;
};

function FilePreviewRow({
  files,
  onRemove,
  removeLabel,
}: {
  files: File[];
  onRemove: (i: number) => void;
  removeLabel: string;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {files.map((f, i) => (
        <li
          key={`${f.name}-${i}`}
          className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs"
        >
          <span className="min-w-0 truncate">{f.name}</span>
          <button type="button" className="shrink-0 text-gray-500 hover:text-red-600" onClick={() => onRemove(i)}>
            {removeLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}

function parsePathArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function valueAfterPrefix(block: string, prefixes: string[]): string {
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    for (const prefix of prefixes) {
      if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length).trim();
    }
  }
  return '';
}

function splitInternalAddress(description: string): { intro: string; addressBlock: string } {
  const headers = ['地址（內部）：', '地址（内部）：', 'Address (internal):'];
  for (const header of headers) {
    const idx = description.indexOf(header);
    if (idx >= 0) {
      return {
        intro: description.slice(0, idx).trim(),
        addressBlock: description.slice(idx + header.length).trim(),
      };
    }
  }
  return { intro: description.trim(), addressBlock: '' };
}

function parseUserDescription(intro: string): string {
  const skipPrefixes = [
    '地區：',
    '地区：',
    'District:',
    '類型：',
    '类型：',
    'Type:',
    '建成年份：',
    '装修年份：',
    '裝修年份：',
    '房間配置：',
    '房间配置：',
    '大廈設施：',
    '大厦设施：',
  ];
  return intro
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return !skipPrefixes.some((prefix) => trimmed.startsWith(prefix));
    })
    .join('\n')
    .trim();
}

function parsePropertyTypeId(intro: string, title: string): ListingPropertyTypeId | '' {
  const typeLine = valueAfterPrefix(intro, ['類型：', '类型：', 'Type:']);
  const match = LISTING_PROPERTY_TYPES.find(
    (pt) => pt.label === typeLine || title.includes(pt.label),
  );
  return match?.id ?? '';
}

export function EditListingMediaDialog({
  open,
  onOpenChange,
  landlordId,
  propertyId,
  propertyTitle,
  onSuccess,
}: EditListingMediaDialogProps) {
  const { locale, landlordT, listPropertyT: t } = useLocale();
  const propertyTypes = useMemo(() => getListingPropertyTypes(locale), [locale]);

  const [loading, setLoading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [currentCover, setCurrentCover] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [propertyTypeId, setPropertyTypeId] = useState<ListingPropertyTypeId | ''>('');
  const [district, setDistrict] = useState('');
  const [estateName, setEstateName] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [blockTower, setBlockTower] = useState('');
  const [unit, setUnit] = useState('');
  const [floor, setFloor] = useState('');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [builtYear, setBuiltYear] = useState('');
  const [renovationYear, setRenovationYear] = useState('');
  const [description, setDescription] = useState('');
  const [roomFeatures, setRoomFeatures] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [existingProofPaths, setExistingProofPaths] = useState<string[]>([]);
  const [existingGalleryUrls, setExistingGalleryUrls] = useState<string[]>([]);

  const resetForm = () => {
    setCoverFile(null);
    setCurrentCover('');
    setPhotoFiles([]);
    setVideoFiles([]);
    setError('');
    setSaving(false);
    setLoading(false);
    setTitle('');
    setPropertyTypeId('');
    setDistrict('');
    setEstateName('');
    setBuildingName('');
    setBlockTower('');
    setUnit('');
    setFloor('');
    setPrice('');
    setArea('');
    setBuiltYear('');
    setRenovationYear('');
    setDescription('');
    setRoomFeatures([]);
    setAmenities([]);
    setExistingProofPaths([]);
    setExistingGalleryUrls([]);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      const { data, error: loadError } = await supabase
        .from('properties')
        .select(
          'title, image, price, area, floor, district, description, room_features, amenities, built_year, renovation_year, proof_photo_urls, gallery_urls',
        )
        .eq('id', propertyId)
        .eq('landlord_id', landlordId)
        .maybeSingle();

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setLoading(false);
        return;
      }

      const rawDescription = String(data.description ?? '');
      const { intro, addressBlock } = splitInternalAddress(rawDescription);
      setTitle(String(data.title ?? ''));
      setPropertyTypeId(parsePropertyTypeId(intro, String(data.title ?? '')));
      setDistrict(String(data.district ?? ''));
      setEstateName(valueAfterPrefix(addressBlock, ['屋苑：']));
      setBuildingName(valueAfterPrefix(addressBlock, ['大廈：', '大厦：', 'Building:']));
      setBlockTower(valueAfterPrefix(addressBlock, ['座數：', '座数：', 'Block:']));
      setUnit(valueAfterPrefix(addressBlock, ['單位：', '单位：', 'Unit:']));
      setFloor(String(data.floor ?? '').replace(/\D/g, '') || valueAfterPrefix(addressBlock, ['樓層：', '楼层：', 'Floor:']));
      setPrice(String(data.price ?? '').replace(/\D/g, ''));
      setArea(String(data.area ?? '').replace(/\D/g, ''));
      setBuiltYear(data.built_year != null ? String(data.built_year) : '');
      setRenovationYear(data.renovation_year != null ? String(data.renovation_year) : '');
      setDescription(parseUserDescription(intro));
      setRoomFeatures(parseStringArray(data.room_features));
      setAmenities(parseStringArray(data.amenities));
      setCurrentCover(String(data.image ?? '').trim());
      setExistingProofPaths(parsePathArray(data.proof_photo_urls));
      setExistingGalleryUrls(parsePathArray((data as { gallery_urls?: unknown }).gallery_urls));
      setCoverFile(null);
      setPhotoFiles([]);
      setVideoFiles([]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, propertyId, landlordId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(t.errTitle);
      return;
    }
    if (!propertyTypeId) {
      setError(t.errSelectType);
      return;
    }
    if (!district) {
      setError(t.errSelectDistrict);
      return;
    }
    if (!estateName.trim()) {
      setError(t.errEstateName);
      return;
    }
    if (!buildingName.trim()) {
      setError(t.errBuildingName);
      return;
    }
    const floorNum = parsePositiveInt(floor);
    if (!floorNum) {
      setError(t.errFloor);
      return;
    }
    if (!parsePositiveInt(unit)) {
      setError(t.errUnit);
      return;
    }
    const priceNum = Number(price);
    const areaNum = Number(area);
    if (!Number.isFinite(priceNum) || priceNum < 1000) {
      setError(t.errPrice);
      return;
    }
    if (!Number.isFinite(areaNum) || areaNum < 50) {
      setError(t.errArea);
      return;
    }
    const built = parsePropertyYear(builtYear);
    if (built == null) {
      setError(t.errBuiltYear);
      return;
    }
    const reno = parsePropertyYear(renovationYear);
    if (reno == null || reno < built) {
      setError(t.errRenovationYear);
      return;
    }

    try {
      setSaving(true);
      setError('');

      const galleryFiles = [...photoFiles, ...videoFiles];
      const updatePayload: Record<string, unknown> = {
        title: title.trim(),
        price: priceNum,
        area: areaNum,
        floor: floorNum,
        district,
        room_features: roomFeatures,
        amenities,
        bathrooms: roomFeatures.includes('獨立洗手間') ? 1 : 0,
        built_year: built,
        renovation_year: reno,
        building_age: buildingAgeFromBuiltYear(built),
        description: [
          buildListingDescription({
            description,
            roomFeatures,
            amenities,
            builtYear: built,
            renovationYear: reno,
            propertyTypeId,
            district,
          }),
          '',
          t.addrInternalHeader,
          `${t.addrEstate}${estateName.trim()}`,
          `${t.addrBuilding}${buildingName.trim()}`,
          blockTower.trim() ? `${t.addrBlock}${blockTower.trim()}` : '',
          `${t.addrFloor}${floorNum}`,
          `${t.addrUnit}${unit.trim()}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

      if (coverFile) {
        updatePayload.image = await uploadListingCoverImage(landlordId, coverFile);
      }

      if (galleryFiles.length > 0) {
        const uploaded = await uploadProofPhotoFiles(landlordId, galleryFiles);
        updatePayload.proof_photo_urls = [...existingProofPaths, ...uploaded];
      }

      const publicGalleryAdds: string[] = [];
      if (typeof updatePayload.image === 'string' && updatePayload.image) {
        publicGalleryAdds.push(updatePayload.image);
      }
      for (const file of photoFiles) {
        publicGalleryAdds.push(await uploadListingPublicImage(landlordId, file, 'gallery'));
      }
      if (publicGalleryAdds.length > 0) {
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const url of [...existingGalleryUrls, ...publicGalleryAdds]) {
          const key = url.split('?')[0];
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(url);
        }
        updatePayload.gallery_urls = merged;
      }

      const { error: updateError } = await supabase
        .from('properties')
        .update(updatePayload)
        .eq('id', propertyId)
        .eq('landlord_id', landlordId);

      if (updateError) throw updateError;

      toast.success(landlordT.editListingSuccess);
      resetForm();
      await onSuccess();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : landlordT.editListingFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{landlordT.editListingDialogTitle}</DialogTitle>
          <DialogDescription>
            {propertyTitle}
            <span className="mt-1 block">{landlordT.editListingDialogDesc}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {landlordT.loading}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{landlordT.editListingBasics}</h3>
              <div>
                <Label>{t.listingTitle}</Label>
                <Input className="mt-1.5 bg-white" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>{t.propertyType}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {propertyTypes.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs',
                        propertyTypeId === pt.id
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700',
                      )}
                      onClick={() => setPropertyTypeId(pt.id)}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t.districtTitle}</Label>
                <Select value={district} onValueChange={setDistrict}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t.districtPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {HK_DISTRICTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.estateName}</Label>
                <Input className="mt-1.5 bg-white" value={estateName} onChange={(e) => setEstateName(e.target.value)} />
              </div>
              <div>
                <Label>{t.buildingName}</Label>
                <Input className="mt-1.5 bg-white" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.floor}</Label>
                  <Input
                    className="mt-1.5 bg-white"
                    inputMode="numeric"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div>
                  <Label>{t.unit}</Label>
                  <Input
                    className="mt-1.5 bg-white"
                    inputMode="numeric"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div>
                <Label>{t.blockTower}</Label>
                <Input className="mt-1.5 bg-white" value={blockTower} onChange={(e) => setBlockTower(e.target.value)} />
              </div>
              <div>
                <Label>{t.rentTitle}</Label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    HK$
                  </span>
                  <Input
                    className="bg-white pl-11"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div>
                <Label>{t.areaLabel}</Label>
                <Input
                  className="mt-1.5 bg-white"
                  inputMode="numeric"
                  value={area}
                  onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.buildingAgeTitle}</Label>
                  <Input
                    className="mt-1.5 bg-white"
                    inputMode="numeric"
                    placeholder={t.builtYearPlaceholder}
                    value={builtYear}
                    onChange={(e) => setBuiltYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </div>
                <div>
                  <Label>{t.renovationYearTitle}</Label>
                  <Input
                    className="mt-1.5 bg-white"
                    inputMode="numeric"
                    placeholder={t.renovationYearPlaceholder}
                    value={renovationYear}
                    onChange={(e) => setRenovationYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </div>
              </div>
              <div>
                <Label>{t.descriptionTitle}</Label>
                <Textarea
                  className="mt-1.5 min-h-24 bg-white"
                  placeholder={t.descriptionPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </section>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">{t.coverTitle}</Label>
              <p className="text-xs text-gray-500">{t.coverHint}</p>
              {currentCover && !coverFile ? (
                <img src={currentCover} alt="" className="h-28 w-full rounded-md object-cover" />
              ) : null}
              <LocalizedFileInput
                accept="image/jpeg,image/png,image/webp"
                onFiles={(files) => setCoverFile(files[0] ?? null)}
                showEmptyHint={!coverFile}
              />
              {coverFile ? (
                <FilePreviewRow files={[coverFile]} onRemove={() => setCoverFile(null)} removeLabel={t.remove} />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">{landlordT.editListingPhotos}</Label>
              <p className="text-xs text-gray-500">{landlordT.editListingPhotosHint}</p>
              <LocalizedFileInput
                accept="image/jpeg,image/png,image/webp"
                multiple
                onFiles={(picked) => {
                  if (picked.length > 0) setPhotoFiles((prev) => [...prev, ...picked]);
                }}
                showEmptyHint={photoFiles.length === 0}
              />
              <FilePreviewRow
                files={photoFiles}
                onRemove={(i) => setPhotoFiles((prev) => prev.filter((_, j) => j !== i))}
                removeLabel={t.remove}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">{landlordT.editListingVideos}</Label>
              <p className="text-xs text-gray-500">{landlordT.editListingVideosHint}</p>
              <LocalizedFileInput
                accept="video/mp4,video/quicktime,video/webm"
                multiple
                onFiles={(picked) => {
                  if (picked.length > 0) setVideoFiles((prev) => [...prev, ...picked]);
                }}
                showEmptyHint={videoFiles.length === 0}
              />
              <FilePreviewRow
                files={videoFiles}
                onRemove={(i) => setVideoFiles((prev) => prev.filter((_, j) => j !== i))}
                removeLabel={t.remove}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button
              type="button"
              className="h-11 w-full bg-black text-white hover:bg-gray-800"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {landlordT.editListingSubmit}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
