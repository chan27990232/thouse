import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { LocalizedFileInput } from './ui/LocalizedFileInput';
import { useLocale } from '../context/LocaleContext';
import { uploadDeedFiles, uploadProofPhotoFiles } from '../lib/propertyMediaUpload';
import { supabase } from '../lib/supabase';

type ResubmitCategory = 'proof' | 'deed';

type ResubmitListingMaterialsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landlordId: string;
  propertyId: string;
  propertyTitle: string;
  rejectionReason: string;
  onSuccess: () => void | Promise<void>;
};

export function ResubmitListingMaterialsDialog({
  open,
  onOpenChange,
  landlordId,
  propertyId,
  propertyTitle,
  rejectionReason,
  onSuccess,
}: ResubmitListingMaterialsDialogProps) {
  const { landlordT, listPropertyT: t } = useLocale();
  const [category, setCategory] = useState<ResubmitCategory | ''>('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setCategory('');
    setFiles([]);
    setError('');
    setSaving(false);
  };

  const accept =
    category === 'deed'
      ? 'image/jpeg,image/png,image/webp,application/pdf'
      : 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm';

  const handleSubmit = async () => {
    if (!category) {
      setError(landlordT.resubmitSelectCategory);
      return;
    }
    if (files.length < 1) {
      setError(landlordT.resubmitErrNoFile);
      return;
    }

    try {
      setSaving(true);
      setError('');

      let updatePayload: Record<string, unknown>;
      if (category === 'proof') {
        updatePayload = { proof_photo_urls: await uploadProofPhotoFiles(landlordId, files) };
      } else {
        const deedPaths = await uploadDeedFiles(landlordId, files);
        updatePayload = {
          property_deed_url: deedPaths[0] ?? '',
          property_deed_urls: deedPaths,
        };
      }

      const { error: updateError } = await supabase
        .from('properties')
        .update(updatePayload)
        .eq('id', propertyId)
        .eq('landlord_id', landlordId);

      if (updateError) {
        throw updateError;
      }

      toast.success(landlordT.resubmitSuccess);
      resetForm();
      await onSuccess();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : landlordT.resubmitFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && saving) return;
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="mx-auto max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{landlordT.resubmitDialogTitle}</DialogTitle>
          <DialogDescription>{landlordT.resubmitDialogDesc}</DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium text-gray-900">{propertyTitle}</p>
        <p className="text-xs leading-relaxed whitespace-pre-wrap text-red-600">
          {landlordT.rejectionReasonPrefix}
          {rejectionReason.trim() || landlordT.rejectionReasonEmpty}
        </p>

        <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
          <Label className="text-sm font-semibold text-gray-900">{landlordT.resubmitCategoryLabel}</Label>
          <Select
            value={category || undefined}
            onValueChange={(value) => {
              setCategory(value as ResubmitCategory);
              setFiles([]);
              setError('');
            }}
          >
            <SelectTrigger className="mt-3 w-full bg-white">
              <SelectValue placeholder={landlordT.resubmitCategoryPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proof">{landlordT.resubmitCategoryProof}</SelectItem>
              <SelectItem value="deed">{landlordT.resubmitCategoryDeed}</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
          <Label className="text-sm font-semibold text-gray-900">{landlordT.resubmitUploadLabel}</Label>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {category === 'deed' ? t.deedHint : category === 'proof' ? t.proofHint : landlordT.resubmitSelectCategory}
          </p>
          <div className="mt-3 space-y-3">
            <LocalizedFileInput
              accept={accept}
              multiple
              disabled={!category || saving}
              onFiles={(picked) => {
                if (picked.length > 0) setFiles((prev) => [...prev, ...picked]);
              }}
              showEmptyHint={files.length === 0}
            />
            {files.length > 0 ? (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate">{f.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-gray-500 hover:text-red-600"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    >
                      {t.remove}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1 bg-black text-white hover:bg-gray-800"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.submitting}
              </>
            ) : (
              t.submitReview
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
