import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MapPin, Bed, Building2, Calendar, Maximize2, ShowerHead } from 'lucide-react';
import { toast } from 'sonner';
import { Property } from '../App';
import { isCurrentUserVerified } from '../lib/identityVerification';
import { Button } from './ui/button';
import { ContactLandlordDialog } from './ContactLandlordDialog';
import {
  formatPublicLandlordDisplayName,
  LandlordProfileDialog,
  LandlordProfileRow,
} from './LandlordProfileDialog';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { getPublicLandlordProfile } from '../lib/profiles';
import { loadPropertyGallery, isPropertyGalleryVideo } from '../lib/properties';
import { useLocale } from '../context/LocaleContext';
// 簽約流程保留於 PropertySignLeaseFlow，之後可在其他入口掛載：
// import { PropertySignLeaseFlow } from './PropertySignLeaseFlow';

interface PropertyDetailProps {
  property: Property;
  onBack: () => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onGoToVerification: () => void;
}

export function PropertyDetail({
  property,
  onBack,
  isAuthenticated,
  onRequireAuth,
  onGoToVerification,
}: PropertyDetailProps) {
  const {
    commonT,
    propertyT,
    filtersT,
    profileT,
    contactLandlordT,
    localizePropertyTitle,
    localizePropertyDistrict,
    extractPropertyAreaFromTitle,
  } = useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const locationLabel =
    localizePropertyDistrict(property.district) ||
    extractPropertyAreaFromTitle(property.title) ||
    propertyT.hongKong;
  const buildingAgeLabel =
    property.buildingAge === 'new'
      ? commonT.buildingAgeNew
      : property.buildingAge === '5-10'
        ? commonT.buildingAge5_10
        : property.buildingAge === '10-20'
          ? commonT.buildingAge10_20
          : property.buildingAge === '20+'
            ? commonT.buildingAge20Plus
            : null;

  const listedRoomFeatures = property.roomFeatures ?? [];
  const listedAmenities = property.amenities ?? [];
  const hasListingFeatures = listedRoomFeatures.length > 0 || listedAmenities.length > 0;
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showLandlordProfile, setShowLandlordProfile] = useState(false);
  const [landlordName, setLandlordName] = useState(contactLandlordT.landlordDefault);
  const [landlordLoading, setLandlordLoading] = useState(Boolean(property.landlordId));
  const [galleryUrls, setGalleryUrls] = useState<string[]>(property.image ? [property.image] : []);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGalleryUrls(property.image ? [property.image] : []);
    setGalleryIndex(0);
    let cancelled = false;
    void loadPropertyGallery(property.id, property.image).then((urls) => {
      if (!cancelled && urls.length > 0) setGalleryUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [property.id, property.image]);

  useEffect(() => {
    if (!property.landlordId) {
      setLandlordName(contactLandlordT.landlordDefault);
      setLandlordLoading(false);
      return;
    }

    let cancelled = false;
    setLandlordLoading(true);

    (async () => {
      try {
        const data = await getPublicLandlordProfile(property.landlordId!);
        if (cancelled) return;
        if (!data) {
          setLandlordName(contactLandlordT.landlordDefault);
          return;
        }
        const fullName = typeof data.full_name === 'string' ? data.full_name : '';
        const salutation =
          data.salutation === '先生' || data.salutation === '女士' || data.salutation === '不便透露'
            ? data.salutation
            : '';
        setLandlordName(
          formatPublicLandlordDisplayName(fullName, salutation, {
            salutationMr: profileT.salutationMr,
            salutationMs: profileT.salutationMs,
            salutationPreferNot: profileT.salutationPreferNot,
            landlordDefault: contactLandlordT.landlordDefault,
            landlordWithSalutation: (s) =>
              contactLandlordT.format('landlordWithSalutation', { salutation: s }),
          }),
        );
      } catch {
        if (!cancelled) setLandlordName(contactLandlordT.landlordDefault);
      } finally {
        if (!cancelled) setLandlordLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    property.landlordId,
    profileT.salutationMr,
    profileT.salutationMs,
    profileT.salutationPreferNot,
    contactLandlordT,
  ]);

  const requireTenantVerified = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return false;
    }
    const verified = await isCurrentUserVerified();
    if (!verified) {
      toast.error(propertyT.tenantVerificationRequired, {
        action: {
          label: propertyT.goToVerification,
          onClick: () => onGoToVerification(),
        },
      });
      return false;
    }
    return true;
  };

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-5xl overflow-x-hidden bg-white">
      <div className="relative">
        <div
          ref={galleryRef}
          className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={() => {
            const el = galleryRef.current;
            if (!el || el.clientWidth <= 0) return;
            const next = Math.round(el.scrollLeft / el.clientWidth);
            setGalleryIndex(Math.min(galleryUrls.length - 1, Math.max(0, next)));
          }}
        >
          {galleryUrls.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="flex h-[min(70vh,32rem)] w-full shrink-0 snap-center items-center justify-center bg-neutral-100 sm:h-[min(75vh,36rem)]"
            >
              {isPropertyGalleryVideo(src) ? (
                <video
                  src={src}
                  className="max-h-full max-w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <ImageWithFallback
                  src={src}
                  alt={displayTitle}
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onBack}
          className="absolute left-3 top-3 z-20 rounded-full bg-white p-2 shadow-lg hover:bg-gray-100 sm:left-4 sm:top-4"
          type="button"
          aria-label={commonT.back}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {galleryUrls.length > 1 ? (
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-10 flex flex-col items-center gap-2">
            <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">
              {propertyT.format('photoIndex', {
                current: galleryIndex + 1,
                total: galleryUrls.length,
              })}
            </span>
            <div className="flex items-center gap-1.5">
              {galleryUrls.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full ${i === galleryIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="p-4 sm:p-6 md:px-8 lg:px-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="mb-1 text-xl sm:text-2xl">{displayTitle}</h1>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{locationLabel}</span>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="text-2xl sm:text-3xl">${property.price}</div>
            <div className="text-gray-500">{commonT.perMonth}</div>
          </div>
        </div>

        <div className="border-y py-5 sm:py-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="text-center">
              <Maximize2 className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
              <div>{property.area}</div>
              <div className="text-sm text-gray-500">{commonT.sqftUnit}</div>
            </div>
            <div className="text-center">
              <Bed className="w-6 h-6 mx-auto mb-2 text-gray-600" />
              <div>{property.bedrooms}</div>
              <div className="text-sm text-gray-500">{commonT.bedrooms}</div>
            </div>
            <div className="text-center">
              <ShowerHead className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
              <div>{property.bathrooms}</div>
              <div className="text-sm text-gray-500">{commonT.bathrooms}</div>
            </div>
            <div className="text-center">
              <Building2 className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
              <div>{property.floor}</div>
              <div className="text-sm text-gray-500">{propertyT.floor}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
            <div className="text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
              <div>
                {property.builtYear
                  ? property.builtYear
                  : buildingAgeLabel
                    ? buildingAgeLabel
                    : propertyT.yearNotProvided}
              </div>
              <div className="text-sm text-gray-500">
                {property.builtYear || !buildingAgeLabel ? propertyT.yearBuilt : propertyT.buildingAge}
              </div>
            </div>
            <div className="text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
              <div>{property.renovationYear ?? propertyT.yearNotProvided}</div>
              <div className="text-sm text-gray-500">{propertyT.yearRenovated}</div>
            </div>
          </div>
        </div>

        {property.landlordId ? (
          <LandlordProfileRow
            name={landlordName}
            loading={landlordLoading}
            onOpen={() => setShowLandlordProfile(true)}
          />
        ) : null}

        <div className="py-6">
          <h2 className="mb-3">{propertyT.descriptionTitle}</h2>
          <p className="text-gray-600 leading-relaxed">{propertyT.descriptionBody}</p>
        </div>

        {hasListingFeatures ? (
          <div className="border-t py-6">
            <h2 className="mb-3">{propertyT.amenitiesTitle}</h2>
            <div className="flex flex-wrap gap-2">
              {listedRoomFeatures.map((name) => (
                <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-700">
                  {filtersT.roomFeature(name)}
                </span>
              ))}
              {listedAmenities.map((name) => (
                <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-700">
                  {filtersT.amenity(name)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <Button
            className="w-full min-h-11 bg-black text-white hover:bg-gray-800 sm:min-h-10"
            onClick={() => {
              void (async () => {
                if (!(await requireTenantVerified())) return;
                setShowContactDialog(true);
              })();
            }}
            type="button"
          >
            {propertyT.contactLandlord}
          </Button>
        </div>
      </div>

      {showContactDialog && (
        <ContactLandlordDialog
          open={showContactDialog}
          onOpenChange={setShowContactDialog}
          property={property}
          isAuthenticated={isAuthenticated}
        />
      )}

      {showLandlordProfile && property.landlordId ? (
        <LandlordProfileDialog
          open={showLandlordProfile}
          onOpenChange={setShowLandlordProfile}
          landlordId={property.landlordId}
        />
      ) : null}
    </div>
  );
}
