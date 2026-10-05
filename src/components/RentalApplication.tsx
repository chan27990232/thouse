import { useEffect, useState } from 'react';
import { Calendar, User, FileText, CreditCard, ArrowRight, FileSignature } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Property } from '../App';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { useLocale } from '../context/LocaleContext';
import { LOCALE_DATE_LOCALE } from '../lib/locale';
import { PhoneCountryField } from './PhoneCountryField';
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  formatPhoneWithCountryCode,
  isValidPhoneCountryCode,
  type PhoneCountryLabelKey,
} from '../lib/phoneCountryCode';
import { fetchLeaseOfferForConversation, type ConversationLeaseOffer } from '../lib/conversationLeaseOffers';

interface RentalApplicationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  conversationId?: string;
  onProceedToPayment: (applicationData: ApplicationData) => void;
}

export interface ApplicationData {
  fullName: string;
  phone: string;
  email: string;
  occupation: string;
  monthlyIncome: string;
  employerName: string;
  moveInDate: Date | undefined;
  leaseDuration: string;
  numberOfOccupants: string;
  hasPets: boolean;
  emergencyContact: string;
  emergencyPhone: string;
  additionalNotes: string;
  agreedToLeaseTerms: boolean;
}

export function RentalApplication({
  open,
  onOpenChange,
  property,
  conversationId,
  onProceedToPayment,
}: RentalApplicationProps) {
  const { locale, rentalApplicationT: t, localizePropertyTitle } = useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const [step, setStep] = useState(1);
  const [leaseOffer, setLeaseOffer] = useState<ConversationLeaseOffer | null>(null);
  const [leaseLoading, setLeaseLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [moveInDate, setMoveInDate] = useState<Date>();
  const [leaseDuration, setLeaseDuration] = useState('12');
  const [numberOfOccupants, setNumberOfOccupants] = useState('1');
  const [hasPets, setHasPets] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhoneCountryCode, setEmergencyPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTermsAccepted(false);
    if (!conversationId) {
      setLeaseOffer(null);
      setLeaseLoading(false);
      return;
    }
    let cancelled = false;
    setLeaseLoading(true);
    (async () => {
      try {
        const offer = await fetchLeaseOfferForConversation(conversationId);
        if (!cancelled) setLeaseOffer(offer);
      } catch {
        if (!cancelled) setLeaseOffer(null);
      } finally {
        if (!cancelled) setLeaseLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  const handleSubmit = () => {
    const applicationData: ApplicationData = {
      fullName,
      phone: formatPhoneWithCountryCode(phoneCountryCode, phone),
      email,
      occupation: '',
      monthlyIncome: '',
      employerName: '',
      moveInDate,
      leaseDuration,
      numberOfOccupants,
      hasPets,
      emergencyContact,
      emergencyPhone: formatPhoneWithCountryCode(emergencyPhoneCountryCode, emergencyPhone),
      additionalNotes,
      agreedToLeaseTerms: termsAccepted,
    };
    onProceedToPayment(applicationData);
  };

  const isLeaseReady = Boolean(leaseOffer?.fileUrl);
  const isStep2Valid = fullName && phone && email && isValidPhoneCountryCode(phoneCountryCode);
  const isStep3Valid =
    Boolean(moveInDate) &&
    Boolean(emergencyContact) &&
    Boolean(emergencyPhone) &&
    isValidPhoneCountryCode(emergencyPhoneCountryCode) &&
    termsAccepted;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileSignature className="h-5 w-5 shrink-0" />
            {t.format('title', { title: displayTitle })}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
          <div className="mt-2 flex gap-2 text-xs text-gray-500">
            <span className={step >= 1 ? 'font-medium text-gray-900' : ''}>{t.stepLeaseLabel}</span>
            <span>·</span>
            <span className={step >= 2 ? 'font-medium text-gray-900' : ''}>{t.step1Label}</span>
            <span>·</span>
            <span className={step >= 3 ? 'font-medium text-gray-900' : ''}>{t.step2Label}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-black' : 'bg-gray-200'}`} />
            <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-black' : 'bg-gray-200'}`} />
            <div className={`h-1 flex-1 rounded ${step >= 3 ? 'bg-black' : 'bg-gray-200'}`} />
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-5 w-5" />
                {t.leaseTitle}
              </h3>
              {leaseLoading ? (
                <p className="text-sm text-gray-500">{t.leaseLoading}</p>
              ) : isLeaseReady && leaseOffer ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{t.leaseFile}</p>
                  <a
                    href={leaseOffer.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 hover:bg-stone-100"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate underline">{leaseOffer.fileName || t.openLease}</span>
                  </a>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-950">
                  <p className="font-medium">{t.leaseWaiting}</p>
                  <p className="mt-1 text-amber-900/80">{t.leaseWaitingHint}</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <User className="h-5 w-5" />
                {t.personalInfoTitle}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="fullName">{t.fullName}</Label>
                <Input
                  id="fullName"
                  placeholder={t.fullNamePlaceholder}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t.phone}</Label>
                <PhoneCountryField
                  className="h-9"
                  countryCode={phoneCountryCode}
                  onCountryCodeChange={setPhoneCountryCode}
                  phone={phone}
                  onPhoneChange={setPhone}
                  phoneId="phone"
                  countryAriaLabel={t.phoneCountryCode}
                  phonePlaceholder={t.phonePlaceholder}
                  optionLabel={(key: PhoneCountryLabelKey) => t[key]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupants">{t.occupants}</Label>
                <RadioGroup value={numberOfOccupants} onValueChange={setNumberOfOccupants}>
                  <div className="flex flex-wrap gap-4">
                    {['1', '2', '3', '4', '5+'].map((num) => (
                      <Label
                        key={num}
                        htmlFor={`occupants-${num}`}
                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                      >
                        <RadioGroupItem
                          value={num}
                          id={`occupants-${num}`}
                          className="border-2 border-black text-black shadow-none [&_svg]:fill-black"
                        />
                        {num}
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>{t.hasPets}</Label>
                <RadioGroup value={hasPets ? 'yes' : 'no'} onValueChange={(v) => setHasPets(v === 'yes')}>
                  <div className="flex flex-wrap gap-4">
                    {(
                      [
                        { value: 'no', id: 'pets-no', label: t.noPets },
                        { value: 'yes', id: 'pets-yes', label: t.yesPets },
                      ] as const
                    ).map((option) => (
                      <Label
                        key={option.value}
                        htmlFor={option.id}
                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                      >
                        <RadioGroupItem
                          value={option.value}
                          id={option.id}
                          className="border-2 border-black text-black shadow-none [&_svg]:fill-black"
                        />
                        {option.label}
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-5 w-5" />
                {t.leaseDetailsTitle}
              </h3>

              <div className="space-y-2">
                <Label>{t.moveInDate}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="w-4 h-4 mr-2" />
                      {moveInDate ? moveInDate.toLocaleDateString(LOCALE_DATE_LOCALE[locale]) : t.pickDate}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={moveInDate}
                      onSelect={setMoveInDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{t.leaseDuration}</Label>
                <RadioGroup value={leaseDuration} onValueChange={setLeaseDuration}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {['6', '12', '24', '36'].map((months) => (
                      <Label
                        key={months}
                        htmlFor={`duration-${months}`}
                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                      >
                        <RadioGroupItem
                          value={months}
                          id={`duration-${months}`}
                          className="border-2 border-black text-black shadow-none [&_svg]:fill-black"
                        />
                        {t.format('leaseMonths', { months })}
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContact">{t.emergencyContact}</Label>
                <Input
                  id="emergencyContact"
                  placeholder={t.emergencyContactPlaceholder}
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">{t.emergencyPhone}</Label>
                <PhoneCountryField
                  className="h-9"
                  countryCode={emergencyPhoneCountryCode}
                  onCountryCodeChange={setEmergencyPhoneCountryCode}
                  phone={emergencyPhone}
                  onPhoneChange={setEmergencyPhone}
                  phoneId="emergencyPhone"
                  countryAriaLabel={t.phoneCountryCode}
                  phonePlaceholder={t.emergencyPhonePlaceholder}
                  optionLabel={(key: PhoneCountryLabelKey) => t[key]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalNotes">{t.additionalNotes}</Label>
                <Textarea
                  id="additionalNotes"
                  placeholder={t.additionalNotesPlaceholder}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-3">
                <Checkbox
                  id="lease-terms"
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(v === true)}
                />
                <label htmlFor="lease-terms" className="cursor-pointer text-sm leading-relaxed text-gray-800">
                  {t.termsPrefix}
                  <strong className="font-semibold">{t.termsLink}</strong>
                  {t.termsMiddle}
                  <strong className="font-semibold">{t.termsPayment}</strong>
                  {t.termsSuffix}
                </label>
              </div>

              {/* Summary */}
              <div className="space-y-2 rounded-lg bg-gray-50 p-4">
                <h4 className="font-medium">{t.summaryTitle}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t.monthlyRent}</span>
                    <span>${property.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.depositTwoMonths}</span>
                    <span>${property.price * 2}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.firstMonthRent}</span>
                    <span>${property.price}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span>{t.rentalSubtotal}</span>
                    <span>${property.price * 3}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{t.platformFee}</span>
                    <span>+${Math.round(property.price * 3 * 0.01)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{t.agencyFee}</span>
                    <span>$0</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{t.extraFees}</span>
                    <span>$0</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">{t.firstPaymentTotal}</span>
                    <span className="text-lg font-medium">${property.price * 3 + Math.round(property.price * 3 * 0.01)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-2 pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} className="flex-1">
                {t.back}
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="flex-1 bg-black text-white hover:bg-gray-800"
                disabled={(step === 1 && !isLeaseReady) || (step === 2 && !isStep2Valid)}
              >
                {t.next}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-black text-white hover:bg-gray-800"
                disabled={!isStep3Valid}
              >
                {t.proceedToPayment}
                <CreditCard className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
