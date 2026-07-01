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
import { useLocale } from '../context/LocaleContext';
import {
  getListingPropertyTypes,
  LISTING_FEATURE_TAG_KEYS,
  type ListingFeatureTagKey,
  type buildListPropertyT,
} from '../content/translations/listProperty';
import { HK_DISTRICTS } from '../lib/hkDistricts';
import {
  LISTING_ROOM_OPTIONS,
  buildListingDescription,
  buildListingTitle,
  type ListingPropertyTypeId,
} from '../lib/listPropertyOptions';
import { uploadDeedFiles, uploadListingCoverImage, uploadProofPhotoFiles } from '../lib/propertyMediaUpload';
import { supabase } from '../lib/supabase';
import { cn } from './ui/utils';

type StepId = 'type' | 'location' | 'specs' | 'media' | 'publish';

type WizardStep = {
  id: StepId;
  label: string;
  icon: typeof Home;
};

type ListPropertyT = ReturnType<typeof buildListPropertyT>;

function StepHeader({ step, t, steps }: { step: number; t: ListPropertyT; steps: WizardStep[] }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>{t.format('stepProgress', { current: step + 1, total: steps.length })}</span>
        <span>{steps[step].label}</span>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => {
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

export interface ListPropertyWizardProps {
  landlordId: string;
  onSuccess: () => void | Promise<void>;
  onCancel: () => void;
}

export function ListPropertyWizard({ landlordId, onSuccess, onCancel }: ListPropertyWizardProps) {
  const { locale, listPropertyT: t, commonT } = useLocale();

  const steps = useMemo<WizardStep[]>(
    () => [
      { id: 'type', label: t.stepType, icon: Home },
      { id: 'location', label: t.stepLocation, icon: MapPin },
      { id: 'specs', label: t.stepSpecs, icon: Building2 },
      { id: 'media', label: t.stepMedia, icon: Camera },
      { id: 'publish', label: t.stepPublish, icon: Sparkles },
    ],
    [t]
  );

  const propertyTypes = useMemo(() => getListingPropertyTypes(locale), [locale]);

  const [step, setStep] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [propertyTypeId, setPropertyTypeId] = useState<ListingPropertyTypeId | ''>('');
  const [district, setDistrict] = useState('');
  const [estateName, setEstateName] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [blockTower, setBlockTower] = useState('');
  const [unit, setUnit] = useState('');
  const [floor, setFloor] = useState('');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [features, setFeatures] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [useCustomTitle, setUseCustomTitle] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [deedFiles, setDeedFiles] = useState<File[]>([]);

  const autoTitle = useMemo(
    () => buildListingTitle({ estateName, buildingName, unit, propertyTypeId }),
    [estateName, buildingName, unit, propertyTypeId]
  );
  const displayTitle = useCustomTitle && customTitle.trim() ? customTitle.trim() : autoTitle;

  const previewLayout = bedrooms === 0 ? t.openPlan : t.format('roomCount', { n: bedrooms });
  const previewBathCount = t.format('bathCount', { n: bathrooms });
  const previewMeta = t.format('previewMeta', {
    area: area || '—',
    floor: floor || '—',
    layout: previewLayout,
    bathCount: previewBathCount,
  });

  const toggleFeature = (tag: string) => {
    setFeatures((prev) => (prev.includes(tag) ? prev.filter((f) => f !== tag) : [...prev, tag]));
  };

  const validateStep = (s: number): string | null => {
    if (s === 0 && !propertyTypeId) return t.errSelectType;
    if (s === 1) {
      if (!district) return t.errSelectDistrict;
      if (!estateName.trim()) return t.errEstateName;
      if (!buildingName.trim()) return t.errBuildingName;
      const f = Number(floor);
      if (!Number.isFinite(f) || f < 0) return t.errFloor;
      if (!unit.trim()) return t.errUnit;
    }
    if (s === 2) {
      const p = Number(price);
      const a = Number(area);
      if (!Number.isFinite(p) || p < 1000) return t.errPrice;
      if (!Number.isFinite(a) || a < 50) return t.errArea;
    }
    if (s === 3) {
      if (proofFiles.length < 1) return t.errProofPhoto;
      if (deedFiles.length < 1) return t.errDeed;
      if (!coverFile && !coverUrl.trim()) return t.errCover;
    }
    if (s === 4 && !displayTitle) return t.errTitle;
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setSaveError(err);
      return;
    }
    setSaveError('');
    setStep((s) => Math.min(s + 1, steps.length - 1));
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
      const deedPaths = await uploadDeedFiles(landlordId, deedFiles);

      const addressLines = [
        `${t.addrEstate}${estateName.trim()}`,
        `${t.addrBuilding}${buildingName.trim()}`,
        blockTower.trim() ? `${t.addrBlock}${blockTower.trim()}` : '',
        `${t.addrFloor}${floor}`,
        `${t.addrUnit}${unit.trim()}`,
      ].filter(Boolean);

      const payload: Record<string, unknown> = {
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
          '',
          t.addrInternalHeader,
          ...addressLines,
        ].join('\n'),
        status: 'available',
        proof_photo_urls: proofPaths,
        property_deed_url: deedPaths[0] ?? '',
        property_deed_urls: deedPaths,
        verification_status: 'pending',
      };

      const { error } = await supabase.from('properties').insert(payload);
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('column') || m.includes('proof_photo') || m.includes('verification') || m.includes('property_deed_urls')) {
          throw new Error(t.errDbMigration);
        }
        throw error;
      }

      await onSuccess();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.errSubmitFailed);
    } finally {
      setSaveLoading(false);
    }
  };

  const stepId = steps[step].id;

  return (
    <div className="flex flex-col">
      <StepHeader step={step} t={t} steps={steps} />

      {stepId === 'type' ? (
        <SectionCard title={t.purposeTitle} hint={t.purposeHint}>
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            <Home className="h-4 w-4" />
            {t.rentOut}
          </div>
          <div>
            <Label className="text-xs text-gray-600">{t.propertyType}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {propertyTypes.map((pt) => (
                <Chip key={pt.id} active={propertyTypeId === pt.id} onClick={() => setPropertyTypeId(pt.id)}>
                  {pt.label}
                </Chip>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {stepId === 'location' ? (
        <div className="space-y-4">
          <SectionCard title={t.districtTitle} hint={t.districtHint}>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="w-full bg-white">
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
          </SectionCard>
          <SectionCard title={t.addressTitle} hint={t.addressHint}>
            <div>
              <Label htmlFor="estate-name">{t.estateName}</Label>
              <Input
                id="estate-name"
                className="mt-1.5 bg-white"
                placeholder={t.estatePlaceholder}
                value={estateName}
                onChange={(e) => setEstateName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="building-name">{t.buildingName}</Label>
              <Input
                id="building-name"
                className="mt-1.5 bg-white"
                placeholder={t.buildingPlaceholder}
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="floor">{t.floor}</Label>
                <Input
                  id="floor"
                  type="text"
                  inputMode="numeric"
                  className="mt-1.5 bg-white"
                  placeholder="12"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <Label htmlFor="unit">{t.unit}</Label>
                <Input
                  id="unit"
                  className="mt-1.5 bg-white"
                  placeholder={t.unitPlaceholder}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="block-tower">{t.blockTower}</Label>
              <Input
                id="block-tower"
                className="mt-1.5 bg-white"
                placeholder={t.blockPlaceholder}
                value={blockTower}
                onChange={(e) => setBlockTower(e.target.value)}
              />
            </div>
          </SectionCard>
        </div>
      ) : null}

      {stepId === 'specs' ? (
        <div className="space-y-4">
          <SectionCard title={t.rentTitle} hint={t.rentHint}>
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
          <SectionCard title={t.areaTitle}>
            <div>
              <Label>{t.areaLabel}</Label>
              <Input
                type="text"
                inputMode="numeric"
                className="mt-1.5 bg-white"
                placeholder="200"
                value={area}
                onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </SectionCard>
          <SectionCard title={t.layoutTitle}>
            <div>
              <Label className="text-xs text-gray-600">{t.rooms}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LISTING_ROOM_OPTIONS.map((n) => (
                  <Chip key={n} active={bedrooms === n} onClick={() => setBedrooms(n)}>
                    {n === 0 ? t.openPlan : t.format('roomCount', { n })}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">{t.bathrooms}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3].map((n) => (
                  <Chip key={n} active={bathrooms === n} onClick={() => setBathrooms(n)}>
                    {t.format('bathCount', { n })}
                  </Chip>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title={t.featuresTitle}>
            <div className="flex flex-wrap gap-2">
              {LISTING_FEATURE_TAG_KEYS.map((tag) => (
                <Chip key={tag} active={features.includes(tag)} onClick={() => toggleFeature(tag)}>
                  {t.featureTag(tag)}
                </Chip>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {stepId === 'media' ? (
        <div className="space-y-4">
          <SectionCard title={t.coverTitle} hint={t.coverHint}>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="bg-white"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setCoverFile(f);
                if (f) setCoverUrl('');
                e.target.value = '';
              }}
            />
            {coverFile ? (
              <FilePreviewRow
                files={[coverFile]}
                onRemove={() => setCoverFile(null)}
                removeLabel={t.remove}
              />
            ) : null}
            <p className="text-xs text-gray-500">{t.orImageUrl}</p>
            <Input
              placeholder="https://..."
              className="bg-white"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              disabled={Boolean(coverFile)}
            />
          </SectionCard>
          <SectionCard title={t.proofTitle} hint={t.proofHint}>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              multiple
              className="bg-white"
              onChange={(e) => {
                const picked = e.target.files ? Array.from(e.target.files) : [];
                if (picked.length > 0) {
                  setProofFiles((prev) => [...prev, ...picked]);
                }
                e.target.value = '';
              }}
            />
            <FilePreviewRow
              files={proofFiles}
              onRemove={(i) => setProofFiles((f) => f.filter((_, j) => j !== i))}
              removeLabel={t.remove}
            />
          </SectionCard>
          <SectionCard title={t.deedTitle} hint={t.deedHint}>
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white p-3">
              <FileCheck2 className="h-5 w-5 shrink-0 text-gray-500" />
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="border-0 bg-transparent p-0 shadow-none"
                onChange={(e) => {
                  const picked = e.target.files ? Array.from(e.target.files) : [];
                  if (picked.length > 0) {
                    setDeedFiles((prev) => [...prev, ...picked]);
                  }
                  e.target.value = '';
                }}
              />
            </div>
            <FilePreviewRow
              files={deedFiles}
              onRemove={(i) => setDeedFiles((f) => f.filter((_, j) => j !== i))}
              removeLabel={t.remove}
            />
          </SectionCard>
        </div>
      ) : null}

      {stepId === 'publish' ? (
        <div className="space-y-4">
          <SectionCard title={t.listingTitle}>
            <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900">
              {autoTitle || t.titlePlaceholder}
            </p>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={useCustomTitle}
                onChange={(e) => setUseCustomTitle(e.target.checked)}
              />
              {t.customTitle}
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
          <SectionCard title={t.descriptionTitle}>
            <Textarea
              className="min-h-[100px] resize-none bg-white"
              placeholder={t.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </SectionCard>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t.preview}</p>
            <h4 className="mt-2 text-base font-semibold text-gray-900">{displayTitle || '—'}</h4>
            <p className="mt-1 text-sm text-gray-600">
              {district} · {propertyTypes.find((pt) => pt.id === propertyTypeId)?.label ?? '—'}
            </p>
            <p className="mt-2 text-lg font-bold text-gray-900">
              HK${Number(price || 0).toLocaleString('en-HK')}
              <span className="text-sm font-normal text-gray-500"> {commonT.perMonth}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">{previewMeta}</p>
            {features.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <span key={f} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {t.featureTag(f as ListingFeatureTagKey)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-gray-500">{t.submitNote}</p>
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
            t.cancel
          ) : (
            <>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t.back}
            </>
          )}
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" className="bg-gray-900 text-white hover:bg-gray-800" onClick={goNext}>
            {t.next}
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
                {t.submitting}
              </>
            ) : (
              t.submitReview
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
