import { useEffect, useState } from 'react';
import { ChevronRight, Star, User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { getPublicLandlordProfile } from '../lib/profiles';
import { salutationForDisplayName } from '../lib/salutation';
import { computeLandlordResponseTimeLabel } from '../lib/landlordResponseTime';
import { getLandlordCompositeStarSummary, type StarSummary } from '../lib/transactionReviews';
import { useLocale } from '../context/LocaleContext';

interface LandlordProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landlordId: string;
}

export function formatPublicLandlordDisplayName(
  fullName: string,
  salutation: string,
  opts: {
    salutationMr: string;
    salutationMs: string;
    salutationPreferNot: string;
    landlordDefault: string;
    landlordWithSalutation: (salutation: string) => string;
  },
) {
  const localizeSalutation = (value: string) => {
    if (value === '先生') return opts.salutationMr;
    if (value === '女士') return opts.salutationMs;
    if (value === '不便透露') return opts.salutationPreferNot;
    return value;
  };

  const trimmedName = fullName.trim();
  const displaySalutation = salutationForDisplayName(salutation);
  const localizedSalutation = displaySalutation ? localizeSalutation(displaySalutation) : '';

  if (!trimmedName) {
    return localizedSalutation ? opts.landlordWithSalutation(localizedSalutation) : opts.landlordDefault;
  }

  const surname = trimmedName.split(/\s+/)[0];
  return localizedSalutation ? `${surname} ${localizedSalutation}` : surname;
}

export function LandlordProfileDialog({ open, onOpenChange, landlordId }: LandlordProfileDialogProps) {
  const { locale, commonT, profileT, contactLandlordT, propertyT } = useLocale();
  const [loading, setLoading] = useState(true);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [starSummary, setStarSummary] = useState<StarSummary>({ avgStars: 0, reviewCount: 0 });
  const [landlord, setLandlord] = useState({
    name: contactLandlordT.landlordDefault,
    responseTime: '',
    isVerified: false,
  });

  useEffect(() => {
    if (!open || !landlordId) return;

    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setRatingLoading(true);

      try {
        const summary = await getLandlordCompositeStarSummary(landlordId);
        if (isMounted) {
          setStarSummary(summary);
          setRatingLoading(false);
        }
      } catch {
        if (isMounted) {
          setStarSummary({ avgStars: 0, reviewCount: 0 });
          setRatingLoading(false);
        }
      }

      try {
        const data = await getPublicLandlordProfile(landlordId);
        if (!isMounted || !data) return;

        const fullName = typeof data.full_name === 'string' ? data.full_name : '';
        const salutation =
          data.salutation === '先生' || data.salutation === '女士' || data.salutation === '不便透露'
            ? data.salutation
            : '';

        setLandlord({
          name: formatPublicLandlordDisplayName(fullName, salutation, {
            salutationMr: profileT.salutationMr,
            salutationMs: profileT.salutationMs,
            salutationPreferNot: profileT.salutationPreferNot,
            landlordDefault: contactLandlordT.landlordDefault,
            landlordWithSalutation: (s) => contactLandlordT.format('landlordWithSalutation', { salutation: s }),
          }),
          responseTime: await computeLandlordResponseTimeLabel(landlordId, locale),
          isVerified: Boolean(data.is_verified),
        });
      } catch {
        // Keep fallback display when RPC is unavailable.
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [
    open,
    landlordId,
    locale,
    profileT.salutationMr,
    profileT.salutationMs,
    profileT.salutationPreferNot,
    contactLandlordT,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{propertyT.landlordProfileTitle}</DialogTitle>
          <DialogDescription className="sr-only">{propertyT.landlordProfileTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-200">
              <User className="h-7 w-7 text-gray-600" />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-lg font-medium">
                {loading ? contactLandlordT.loadingLandlord : landlord.name}
              </h4>
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${
                  landlord.isVerified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {landlord.isVerified ? profileT.verified : profileT.notVerified}
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-4 text-sm text-gray-600">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-gray-500">{contactLandlordT.rating}</span>
              {ratingLoading ? (
                <span className="text-gray-400">{contactLandlordT.ratingLoading}</span>
              ) : (
                <>
                  <div className="flex items-center gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const hasReviews = starSummary.reviewCount > 0;
                      const filled = hasReviews && n <= Math.round(starSummary.avgStars);
                      return (
                        <Star
                          key={n}
                          className={`h-4 w-4 shrink-0 ${filled ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`}
                        />
                      );
                    })}
                  </div>
                  {starSummary.reviewCount === 0 ? (
                    <span className="text-gray-500">{contactLandlordT.noReviews}</span>
                  ) : (
                    <span>
                      {contactLandlordT.format('avgRating', {
                        avg: starSummary.avgStars.toFixed(1),
                        count: starSummary.reviewCount,
                      })}
                    </span>
                  )}
                </>
              )}
            </div>
            <p>
              {contactLandlordT.format('avgResponseTime', {
                time: landlord.responseTime || commonT.loading,
              })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Compact row used on property detail; click opens landlord profile. */
export function LandlordProfileRow({
  name,
  loading,
  onOpen,
}: {
  name: string;
  loading?: boolean;
  onOpen: () => void;
}) {
  const { propertyT } = useLocale();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b py-4 text-left transition-colors hover:bg-gray-50"
      aria-label={propertyT.viewLandlordProfile}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-200">
        <User className="h-5 w-5 text-gray-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{propertyT.landlordLabel}</p>
        <p className="truncate text-sm font-medium text-gray-900">
          {loading ? propertyT.landlordLoading : name}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
    </button>
  );
}
