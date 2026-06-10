import { useMemo, useState, type ReactNode } from 'react';
import {
  Building2,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Home,
  Loader2,
  MapPin,
  Sparkles,
} from 'lucide-react';
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
import { HK_DISTRICTS } from '../lib/hkDistricts';
import {
  LISTING_FEATURE_TAGS,
  LISTING_PROPERTY_TYPES,
  LISTING_ROOM_OPTIONS,
  buildListingDescription,
  buildListingTitle,
  type ListingPropertyTypeId,
} from '../lib/listPropertyOptions';
import { uploadDeedFile, uploadListingCoverImage, uploadProofPhotoFiles } from '../lib/propertyMediaUpload';
import { supabase } from '../lib/supabase';
import { cn } from './ui/utils';

const STEPS = [
  { id: 'type', label: '物業類型', icon: Home },
  { id: 'location', label: '位置', icon: MapPin },
  { id: 'specs', label: '租金規格', icon: Building2 },
  { id: 'media', label: '相片證明', icon: Camera },
  { id: 'publish', label: '介紹預覽', icon: Sparkles },
] as const;

type StepId = (typeof STEPS)[number]['id'];

function StepHeader({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          步驟 {step + 1} / {STEPS.length}
        </span>
        <span>{STEPS[step].label}</span>
      </div>
      <div className="flex gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors',
                  done && 'border-emerald-600 bg-emerald-600 text-white',
                  active && !done && 'border-gray-900 bg-gray-900 text-white',
                  !done && !active && 'border-gray-200 bg-white text-gray-400'
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={cn(
                  'hidden truncate text-center text-[10px] sm:block',
                  active ? 'font-medium text-gray-900' : 'text-gray-500'
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-gray-500">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
      )}
    >
      {children}
    </button>
  );
}

function FilePreviewRow({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
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
            移除
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface ListPropertyWizardProps {
  landlordId: string;
  onSuccess: () => void | Promise<void>;
  onCancel: () => void;
}

export function ListPropertyWizard({ landlordId, onSuccess, onCancel }: ListPropertyWizardProps) {
  const [step, setStep] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [propertyTypeId, setPropertyTypeId] = useState<ListingPropertyTypeId | ''>('');
  const [district, setDistrict] = useState('');
  const [areaLabel, setAreaLabel] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [streetHint, setStreetHint] = useState('');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [floor, setFloor] = useState('');
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [features, setFeatures] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [useCustomTitle, setUseCustomTitle] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [deedFile, setDeedFile] = useState<File | null>(null);

  const autoTitle = useMemo(
    () => buildListingTitle({ areaLabel, buildingName, propertyTypeId }),
    [areaLabel, buildingName, propertyTypeId]
  );
  const displayTitle = useCustomTitle && customTitle.trim() ? customTitle.trim() : autoTitle;

  const toggleFeature = (tag: string) => {
    setFeatures((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const validateStep = (s: number): string | null => {
    if (s === 0 && !propertyTypeId) return '請選擇物業類型';
    if (s === 1) {
      if (!district) return '請選擇地區';
      if (!areaLabel.trim()) return '請輸入區域或屋苑名稱（例如：荃灣、油麻地）';
    }
    if (s === 2) {
      const p = Number(price);
      const a = Number(area);
      const f = Number(floor);
      if (!Number.isFinite(p) || p < 1000) return '請輸入有效月租金額（HK$1,000 起）';
      if (!Number.isFinite(a) || a < 50) return '請輸入實用面積（平方呎）';
      if (!Number.isFinite(f) || f < 0) return '請輸入樓層';
    }
    if (s === 3) {
      if (proofFiles.length < 1) return '請上傳至少一張實景相片';
      if (!deedFile) return '請上傳房產證明';
      if (!coverFile && !coverUrl.trim()) return '請上傳租盤主圖或填寫主圖網址';
    }
    if (s === 4 && !displayTitle) return '請確認放盤標題';
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setSaveError(err);
      return;
    }
    setSaveError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setSaveError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const err = validateStep(4);
    if (err) {
      setSaveError(err);
      return;
    }
    try {
      setSaveError('');
      setSaveLoading(true);

      let imageUrl = coverUrl.trim();
      if (coverFile) {
        imageUrl = await uploadListingCoverImage(landlordId, coverFile);
      }
      const proofPaths = await uploadProofPhotoFiles(landlordId, proofFiles);
      const deedPath = await uploadDeedFile(landlordId, deedFile!);

      const payload = {
        landlord_id: landlordId,
        title: displayTitle,
        image: imageUrl,
        price: Number(price),
        area: Number(area),
        floor: Number(floor),
        bedrooms,
        bathrooms,
        district,
        description: [
          buildListingDescription({
            description,
            features,
            propertyTypeId,
            district,
          }),
          streetHint.trim() ? `街道／座數（內部）：${streetHint.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        status: 'available',
        proof_photo_urls: proofPaths,
        property_deed_url: deedPath,
        verification_status: 'pending',
      };

      const { error } = await supabase.from('properties').insert(payload);
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('column') || m.includes('proof_photo') || m.includes('verification')) {
          throw new Error(
            '資料庫尚未套用審核欄位。請執行 supabase/property_listing_verification.sql 後再試。'
          );
        }
        throw error;
      }

      await onSuccess();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '新增租盤失敗，請稍後再試。');
    } finally {
      setSaveLoading(false);
    }
  };

  const stepId = STEPS[step].id;

  return (
    <div className="flex flex-col">
      <StepHeader step={step} />

      {stepId === 'type' ? (
        <SectionCard title="放盤用途" hint="簡屋目前僅支援住宅出租放盤。">
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            <Home className="h-4 w-4" />
            出租
          </div>
          <div>
            <Label className="text-xs text-gray-600">物業類型</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {LISTING_PROPERTY_TYPES.map((t) => (
                <Chip key={t.id} active={propertyTypeId === t.id} onClick={() => setPropertyTypeId(t.id)}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {stepId === 'location' ? (
        <div className="space-y-4">
          <SectionCard title="地區" hint="請選擇物業所在的香港行政區。">
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="選擇地區（十八區）" />
              </SelectTrigger>
              <SelectContent>
                {HK_DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SectionCard>
          <SectionCard title="地址資料" hint="屋苑或大廈名稱提交後如需修改，須經平台處理。">
            <div>
              <Label htmlFor="area-label">區域／屋苑名稱</Label>
              <Input
                id="area-label"
                className="mt-1.5 bg-white"
                placeholder="例如：荃灣、油麻地、海濱花園"
                value={areaLabel}
                onChange={(e) => setAreaLabel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="building-name">大廈／屋苑名稱（選填）</Label>
              <Input
                id="building-name"
                className="mt-1.5 bg-white"
                placeholder="例如：雅賓大廈、某苑某座"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="street-hint">街道或座數（選填）</Label>
              <Input
                id="street-hint"
                className="mt-1.5 bg-white"
                placeholder="僅供內部參考，不會公開顯示聯絡方式"
                value={streetHint}
                onChange={(e) => setStreetHint(e.target.value)}
              />
            </div>
          </SectionCard>
        </div>
      ) : null}

      {stepId === 'specs' ? (
        <div className="space-y-4">
          <SectionCard title="租金" hint="請填寫每月租金（港幣）。">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                HK$
              </span>
              <Input
                type="text"
                inputMode="numeric"
                className="bg-white pl-11"
                placeholder="8000"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </SectionCard>
          <SectionCard title="面積與樓層">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>實用面積（呎）</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="mt-1.5 bg-white"
                  placeholder="200"
                  value={area}
                  onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <Label>樓層</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="mt-1.5 bg-white"
                  placeholder="12"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
          </SectionCard>
          <SectionCard title="間隔">
            <div>
              <Label className="text-xs text-gray-600">房間</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LISTING_ROOM_OPTIONS.map((n) => (
                  <Chip key={n} active={bedrooms === n} onClick={() => setBedrooms(n)}>
                    {n === 0 ? '開放式' : `${n} 房`}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">浴室</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3].map((n) => (
                  <Chip key={n} active={bathrooms === n} onClick={() => setBathrooms(n)}>
                    {n} 廁
                  </Chip>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="單位特色（選填）">
            <div className="flex flex-wrap gap-2">
              {LISTING_FEATURE_TAGS.map((tag) => (
                <Chip key={tag} active={features.includes(tag)} onClick={() => toggleFeature(tag)}>
                  {tag}
                </Chip>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {stepId === 'media' ? (
        <div className="space-y-4">
          <SectionCard
            title="租盤主圖"
            hint="將顯示於搜尋列表；建議橫向相片，光線充足。"
          >
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="bg-white"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-gray-500">或填寫圖片網址</p>
            <Input
              placeholder="https://..."
              className="bg-white"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              disabled={Boolean(coverFile)}
            />
          </SectionCard>
          <SectionCard title="實景相片" hint="至少一張，用作平台審核佐證。">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="bg-white"
              onChange={(e) => setProofFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            <FilePreviewRow files={proofFiles} onRemove={(i) => setProofFiles((f) => f.filter((_, j) => j !== i))} />
          </SectionCard>
          <SectionCard title="房產證明" hint="圖片或 PDF，僅供審核，不會公開。">
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-3">
              <FileCheck2 className="h-5 w-5 shrink-0 text-gray-500" />
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="border-0 bg-transparent p-0 shadow-none"
                onChange={(e) => setDeedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {deedFile ? <p className="text-xs text-gray-600">已選：{deedFile.name}</p> : null}
          </SectionCard>
        </div>
      ) : null}

      {stepId === 'publish' ? (
        <div className="space-y-4">
          <SectionCard title="放盤標題">
            <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900">
              {autoTitle || '（請先填寫位置與類型）'}
            </p>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={useCustomTitle}
                onChange={(e) => setUseCustomTitle(e.target.checked)}
              />
              自行修改標題
            </label>
            {useCustomTitle ? (
              <Input
                className="bg-white"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={autoTitle}
              />
            ) : null}
          </SectionCard>
          <SectionCard title="租盤介紹（選填）">
            <Textarea
              className="min-h-[100px] resize-none bg-white"
              placeholder="補充交通、周邊配套、租約要求等…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </SectionCard>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">預覽</p>
            <h4 className="mt-2 text-base font-semibold text-gray-900">{displayTitle || '—'}</h4>
            <p className="mt-1 text-sm text-gray-600">
              {district} · {LISTING_PROPERTY_TYPES.find((t) => t.id === propertyTypeId)?.label ?? '—'}
            </p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              HK${Number(price || 0).toLocaleString('en-HK')}
              <span className="text-sm font-normal text-gray-500"> /月</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {area || '—'} 呎 · {floor || '—'} 樓 · {bedrooms === 0 ? '開放式' : `${bedrooms} 房`} · {bathrooms} 廁
            </p>
            {features.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <span key={f} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {f}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-gray-500">
            提交後租盤進入審核，通過後方會出現在租客首頁。請確保資料真實準確。
          </p>
        </div>
      ) : null}

      {saveError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={step === 0 ? onCancel : goBack} disabled={saveLoading}>
          {step === 0 ? (
            '取消'
          ) : (
            <>
              <ChevronLeft className="mr-1 h-4 w-4" />
              上一步
            </>
          )}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" className="bg-gray-900 text-white hover:bg-gray-800" onClick={goNext}>
            下一步
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-gray-900 text-white hover:bg-gray-800"
            disabled={saveLoading}
            onClick={() => void handleSubmit()}
          >
            {saveLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中…
              </>
            ) : (
              '提交審核'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
