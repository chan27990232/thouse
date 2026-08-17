import { useEffect, useState } from 'react';
import { MessageCircle, Send, Check, User, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Property } from '../App';
import { toast } from 'sonner';
import { getPublicLandlordProfile } from '../lib/profiles';
import { salutationForDisplayName } from '../lib/salutation';
import { supabase } from '../lib/supabase';
import { sendTenantInquiryMessage } from '../lib/conversations';
import { computeLandlordResponseTimeLabel } from '../lib/landlordResponseTime';
import { getPropertyStarSummary, type StarSummary } from '../lib/transactionReviews';
import { isCurrentUserVerified } from '../lib/identityVerification';
import { useLocale } from '../context/LocaleContext';

interface ContactLandlordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  isAuthenticated: boolean;
}

export function ContactLandlordDialog({ open, onOpenChange, property, isAuthenticated }: ContactLandlordDialogProps) {
  const { locale, commonT, profileT, contactLandlordT, localizePropertyTitle } = useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const [messageSent, setMessageSent] = useState(false);
  const [landlordLoading, setLandlordLoading] = useState(true);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [starSummary, setStarSummary] = useState<StarSummary>({ avgStars: 0, reviewCount: 0 });

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const [sending, setSending] = useState(false);
  const [landlord, setLandlord] = useState({
    name: contactLandlordT.landlordDefault,
    responseTime: '',
    isVerified: false,
  });

  const localizeSalutation = (salutation: string) => {
    if (salutation === '先生') return profileT.salutationMr;
    if (salutation === '女士') return profileT.salutationMs;
    if (salutation === '不便透露') return profileT.salutationPreferNot;
    return salutation;
  };

  const formatLandlordDisplayName = (fullName: string, salutation: string) => {
    const trimmedName = fullName.trim();
    const displaySalutation = salutationForDisplayName(salutation);
    const localizedSalutation = displaySalutation ? localizeSalutation(displaySalutation) : '';

    if (!trimmedName) {
      return localizedSalutation
        ? contactLandlordT.format('landlordWithSalutation', { salutation: localizedSalutation })
        : contactLandlordT.landlordDefault;
    }

    const surname = trimmedName.split(/\s+/)[0];
    return localizedSalutation ? `${surname} ${localizedSalutation}` : surname;
  };

  useEffect(() => {
    setLandlord((prev) => ({ ...prev, name: contactLandlordT.landlordDefault }));
  }, [contactLandlordT.landlordDefault]);

  useEffect(() => {
    let isMounted = true;

    const loadLandlordProfile = async () => {
      if (!property.landlordId) {
        if (isMounted) {
          setLandlordLoading(false);
          setRatingLoading(false);
          setStarSummary({ avgStars: 0, reviewCount: 0 });
        }
        return;
      }

      setLandlordLoading(true);
      setRatingLoading(true);

      let summary: StarSummary = { avgStars: 0, reviewCount: 0 };
      try {
        summary = await getPropertyStarSummary(property.id);
      } catch {
        summary = { avgStars: 0, reviewCount: 0 };
      }
      if (isMounted) {
        setStarSummary(summary);
        setRatingLoading(false);
      }

      if (!isMounted) return;

      try {
        const data = await getPublicLandlordProfile(property.landlordId);

        if (!isMounted || !data) return;

        const fullName = typeof data.full_name === 'string' ? data.full_name : '';
        const salutation =
          data.salutation === '先生' || data.salutation === '女士' || data.salutation === '不便透露'
            ? data.salutation
            : '';
        setLandlord({
          name: formatLandlordDisplayName(fullName, salutation),
          responseTime: await computeLandlordResponseTimeLabel(property.landlordId, locale),
          isVerified: Boolean(data.is_verified),
        });
      } catch {
        // Keep fallback landlord display when RPC is not yet available.
      } finally {
        if (isMounted) {
          setLandlordLoading(false);
        }
      }
    };

    void loadLandlordProfile();

    return () => {
      isMounted = false;
    };
  }, [property.landlordId, locale, profileT.salutationMr, profileT.salutationMs]);

  const handleSendMessage = async () => {
    if (!name || !message) {
      toast.error(contactLandlordT.toastFillRequired);
      return;
    }
    if (!isAuthenticated) {
      toast.error(contactLandlordT.toastLoginRequired);
      return;
    }
    if (!(await isCurrentUserVerified())) {
      toast.error(contactLandlordT.toastVerificationRequired);
      return;
    }
    if (!property.landlordId) {
      toast.error(contactLandlordT.toastMissingLandlord);
      return;
    }

    setSending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        throw new Error(contactLandlordT.toastAuthError);
      }
      if (user.id === property.landlordId) {
        toast.error(contactLandlordT.toastSelfLandlord);
        return;
      }

      await sendTenantInquiryMessage({
        propertyId: property.id,
        landlordId: property.landlordId,
        tenantId: user.id,
        tenantDisplayName: name.trim(),
        message,
        contactName: name,
      });

      setMessageSent(true);
      toast.success(contactLandlordT.toastSent);
      setTimeout(() => {
        onOpenChange(false);
        setMessageSent(false);
        setName('');
        setMessage('');
      }, 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : contactLandlordT.toastSendFailed);
    } finally {
      setSending(false);
    }
  };

  if (messageSent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl">{contactLandlordT.messageSentTitle}</h2>
            <p className="text-gray-600">
              {contactLandlordT.messageSentBody}
              <br />
              {contactLandlordT.format('expectedResponse', { time: landlord.responseTime })}
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{contactLandlordT.propertyLabel}</span>
                <span>{displayTitle}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{contactLandlordT.landlordLabel}</span>
                <span>{landlord.name}</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">{contactLandlordT.messageSentHint}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {contactLandlordT.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">{contactLandlordT.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">{displayTitle}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>{contactLandlordT.monthlyRent}</span>
                <span className="font-medium text-black">${property.price}</span>
              </div>
              <div className="flex justify-between">
                <span>{contactLandlordT.area}</span>
                <span>
                  {property.area} {commonT.sqftUnit}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium">
                    {landlordLoading ? contactLandlordT.loadingLandlord : landlord.name}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        landlord.isVerified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {landlord.isVerified ? profileT.verified : profileT.notVerified}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
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
                    <span className="text-gray-600">
                      {contactLandlordT.format('avgRating', {
                        avg: starSummary.avgStars.toFixed(1),
                        count: starSummary.reviewCount,
                      })}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {contactLandlordT.format('avgResponseTime', { time: landlord.responseTime || commonT.loading })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{contactLandlordT.yourName}</Label>
              <Input
                id="name"
                placeholder={contactLandlordT.yourNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{contactLandlordT.message}</Label>
              <Textarea
                id="message"
                placeholder={contactLandlordT.messagePlaceholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              <p className="font-medium mb-1">{contactLandlordT.quickTemplatesTitle}</p>
              <button
                className="text-left hover:underline block"
                type="button"
                onClick={() => setMessage(contactLandlordT.templateVisit)}
              >
                • {contactLandlordT.templateVisit}
              </button>
              <button
                className="text-left hover:underline block"
                type="button"
                onClick={() => setMessage(contactLandlordT.templateNegotiate)}
              >
                • {contactLandlordT.templateNegotiate}
              </button>
              <button
                className="text-left hover:underline block"
                type="button"
                onClick={() => setMessage(contactLandlordT.templateMoveIn)}
              >
                • {contactLandlordT.templateMoveIn}
              </button>
            </div>

            <Button
              onClick={handleSendMessage}
              className="w-full bg-black text-white hover:bg-gray-800"
              disabled={sending || !name || !message}
              type="button"
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? contactLandlordT.sending : contactLandlordT.sendMessage}
            </Button>
          </div>

          <div className="text-xs text-center text-gray-500 pt-4 border-t">{contactLandlordT.privacyFooter}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
