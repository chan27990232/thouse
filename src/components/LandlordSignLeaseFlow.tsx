import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileSignature, FileText, Upload, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Property } from '../App';
import { useLocale } from '../context/LocaleContext';
import { PhoneCountryField } from './PhoneCountryField';
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  formatPhoneWithCountryCode,
  isValidPhoneCountryCode,
  type PhoneCountryLabelKey,
} from '../lib/phoneCountryCode';
import { fetchLeaseOfferForConversation, upsertConversationLeaseOffer, uploadLeaseOfferFile } from '../lib/conversationLeaseOffers';
import { buildLeaseNoticeBody } from '../lib/leaseNotice';
import type { ParsedChatAttachment } from '../lib/chatMessageBody';

type LandlordSignLeaseFlowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  conversationId: string;
  landlordId: string;
  tenantId: string;
  onSubmitted?: (payload: { attachment: ParsedChatAttachment; text: string }) => Promise<void>;
};

export function LandlordSignLeaseFlow({
  open,
  onOpenChange,
  property,
  conversationId,
  landlordId,
  tenantId,
  onSubmitted,
}: LandlordSignLeaseFlowProps) {
  const { rentalApplicationT: t, localizePropertyTitle, chatT } = useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(1);
    let cancelled = false;
    (async () => {
      try {
        const existing = await fetchLeaseOfferForConversation(conversationId);
        if (cancelled || !existing) return;
        setFileName(existing.fileName);
        setFileUrl(existing.fileUrl);
        setFullName(existing.landlordFullName);
        setEmail(existing.landlordEmail);
      } catch {
        /* 尚未建表時由提交時提示 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  const handlePickFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadLeaseOfferFile(landlordId, file);
      setFileName(uploaded.name);
      setFileUrl(uploaded.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.uploadingFile);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isStep1Valid = Boolean(fileUrl && fileName) && !uploading;
  const isStep2Valid = Boolean(fullName.trim() && phone.trim() && email.trim() && isValidPhoneCountryCode(phoneCountryCode));

  const handleSubmit = async () => {
    if (!isStep1Valid || !isStep2Valid || saving) return;
    setSaving(true);
    try {
      await upsertConversationLeaseOffer({
        conversationId,
        propertyId: property.id,
        landlordId,
        tenantId,
        fileUrl,
        fileName,
        landlordFullName: fullName,
        landlordPhone: formatPhoneWithCountryCode(phoneCountryCode, phone),
        landlordEmail: email,
      });
      await onSubmitted?.({
        attachment: { url: fileUrl, kind: 'file', name: fileName },
        text: buildLeaseNoticeBody('offer', chatT.leaseNotifyMessage),
      });
      toast.success(t.leaseOfferSaved);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.leaseOfferSaved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileSignature className="h-5 w-5 shrink-0" />
            {t.format('landlordSignTitle', { title: displayTitle })}
          </DialogTitle>
          <DialogDescription>{t.landlordSignDescription}</DialogDescription>
          <div className="mt-2 flex gap-2 text-xs text-gray-500">
            <span className={step >= 1 ? 'font-medium text-gray-900' : ''}>{t.landlordStep1Label}</span>
            <span>·</span>
            <span className={step >= 2 ? 'font-medium text-gray-900' : ''}>{t.landlordStep2Label}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-black' : 'bg-gray-200'}`} />
            <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-black' : 'bg-gray-200'}`} />
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 1 ? (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-5 w-5" />
                {t.uploadLease}
              </h3>
              <p className="text-sm text-gray-600">{t.uploadLeaseHint}</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,image/*,application/pdf"
                onChange={(e) => void handlePickFile(e.target.files?.[0] ?? null)}
              />
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 hover:bg-stone-100"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate underline">{fileName}</span>
                </a>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? t.uploadingFile : fileUrl ? t.replaceFile : t.chooseFile}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <User className="h-5 w-5" />
                {t.personalInfoTitle}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="landlord-fullName">{t.fullName}</Label>
                <Input
                  id="landlord-fullName"
                  placeholder={t.fullNamePlaceholder}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landlord-phone">{t.phone}</Label>
                <PhoneCountryField
                  className="h-9"
                  countryCode={phoneCountryCode}
                  onCountryCodeChange={setPhoneCountryCode}
                  phone={phone}
                  onPhoneChange={setPhone}
                  phoneId="landlord-phone"
                  countryAriaLabel={t.phoneCountryCode}
                  phonePlaceholder={t.phonePlaceholder}
                  optionLabel={(key: PhoneCountryLabelKey) => t[key]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landlord-email">{t.email}</Label>
                <Input
                  id="landlord-email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {step > 1 ? (
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                {t.back}
              </Button>
            ) : null}
            {step === 1 ? (
              <Button
                type="button"
                className="flex-1 bg-black text-white hover:bg-gray-800"
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
              >
                {t.next}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1 bg-black text-white hover:bg-gray-800"
                disabled={!isStep2Valid || saving}
                onClick={() => void handleSubmit()}
              >
                {t.submitLeaseOffer}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
