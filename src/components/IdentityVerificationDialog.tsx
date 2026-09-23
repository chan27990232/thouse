import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { LocalizedFileInput } from './ui/LocalizedFileInput';
import { useLocale } from '../context/LocaleContext';
import { submitIdentityVerification, validateHongKongIdNumber } from '../lib/identityVerification';

interface IdentityVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: 'tenant' | 'landlord';
  defaultLegalName?: string;
  onSubmitted: () => void;
}

export function IdentityVerificationDialog({
  open,
  onOpenChange,
  role,
  defaultLegalName = '',
  onSubmitted,
}: IdentityVerificationDialogProps) {
  const { profileT } = useLocale();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [legalName, setLegalName] = useState(defaultLegalName);
  const [idNumberBody, setIdNumberBody] = useState('');
  const [idNumberCheck, setIdNumberCheck] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const composedIdNumber = () => {
    const body = idNumberBody.trim().toUpperCase();
    const check = idNumberCheck.trim().toUpperCase();
    if (!body && !check) return '';
    return `${body}(${check})`;
  };

  const resetForm = () => {
    setLegalName(defaultLegalName);
    setIdNumberBody('');
    setIdNumberCheck('');
    setDateOfBirth('');
    setIdCardFile(null);
    setBankFile(null);
    setError('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    else setLegalName(defaultLegalName);
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setError('');
    if (!legalName.trim()) {
      setError(profileT.verificationLegalNamePlaceholder);
      return;
    }
    const idNumber = composedIdNumber();
    if (!validateHongKongIdNumber(idNumber)) {
      setError(profileT.verificationIdNumberInvalid);
      return;
    }
    if (!dateOfBirth) {
      setError(profileT.verificationDateOfBirth);
      return;
    }
    if (!idCardFile) {
      setError(profileT.verificationIdCardRequired);
      return;
    }
    if (!bankFile) {
      setError(profileT.verificationBankRequired);
      return;
    }

    setSubmitting(true);
    try {
      await submitIdentityVerification({
        role,
        legalName: legalName.trim(),
        idNumber,
        dateOfBirth,
        idCardFile,
        bankStatementFile: bankFile,
      });
      onSubmitted();
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : profileT.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profileT.verificationDialogTitle}</DialogTitle>
          <DialogDescription>{profileT.verificationDialogIntro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label htmlFor="verify-legal-name">{profileT.verificationLegalName}</Label>
            <Input
              id="verify-legal-name"
              className="mt-2 h-11"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder={profileT.verificationLegalNamePlaceholder}
            />
          </div>

          <div>
            <Label htmlFor="verify-id-number">{profileT.verificationIdNumber}</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="verify-id-number"
                className="h-11 min-w-0 flex-1 uppercase"
                value={idNumberBody}
                maxLength={8}
                autoComplete="off"
                inputMode="text"
                onChange={(e) =>
                  setIdNumberBody(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                }
                placeholder={profileT.verificationIdNumberBodyPlaceholder}
              />
              <span className="shrink-0 text-lg font-medium text-gray-700" aria-hidden>
                (
              </span>
              <Input
                id="verify-id-check"
                className="h-11 w-14 shrink-0 px-2 text-center uppercase"
                value={idNumberCheck}
                maxLength={1}
                autoComplete="off"
                inputMode="text"
                aria-label={profileT.verificationIdNumberCheckAria}
                onChange={(e) =>
                  setIdNumberCheck(e.target.value.toUpperCase().replace(/[^0-9A]/g, '').slice(0, 1))
                }
                placeholder={profileT.verificationIdNumberCheckPlaceholder}
              />
              <span className="shrink-0 text-lg font-medium text-gray-700" aria-hidden>
                )
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="verify-dob">{profileT.verificationDateOfBirth}</Label>
            <Input
              id="verify-dob"
              type="date"
              className="mt-2 h-11"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div>
            <Label>{profileT.verificationIdCard}</Label>
            <p className="mt-1 text-xs text-gray-500">{profileT.verificationIdCardHint}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) setIdCardFile(file);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {profileT.verificationTakePhoto}
              </Button>
              <LocalizedFileInput
                className="flex-1"
                accept="image/*"
                showEmptyHint={false}
                onFiles={(files) => setIdCardFile(files[0] ?? null)}
              />
            </div>
            {idCardFile ? <p className="mt-2 text-xs text-gray-700">{idCardFile.name}</p> : null}
          </div>

          <div>
            <Label>{profileT.verificationBankStatements}</Label>
            <p className="mt-1 text-xs text-gray-500">{profileT.verificationBankStatementsHint}</p>
            <div className="mt-2">
              <LocalizedFileInput
                accept="image/*,application/pdf"
                showEmptyHint={false}
                onFiles={(files) => setBankFile(files[0] ?? null)}
              />
              {bankFile ? <p className="mt-2 text-xs text-gray-700">{bankFile.name}</p> : null}
            </div>
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {profileT.verificationCancel}
          </Button>
          <Button
            type="button"
            className="bg-black text-white hover:bg-gray-800"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? profileT.submitting : profileT.verificationConfirmSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
