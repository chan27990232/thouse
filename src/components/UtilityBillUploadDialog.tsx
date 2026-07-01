import { useMemo, useState } from 'react';
import { Droplets, FileUp, Flame, Loader2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  uploadPropertyUtilityBills,
  billMonthToDate,
  validateUtilityBillFiles,
  UTILITY_BILL_MAX_FILES,
  UTILITY_BILL_MAX_TOTAL_BYTES,
  type UtilityBillType,
} from '../lib/propertyUtilityBills';
import { useLocale } from '../context/LocaleContext';

type PropertyRef = { id: string; title: string };

const BILL_TYPES: UtilityBillType[] = ['water', 'electricity', 'gas'];

const BILL_TYPE_ICON: Record<UtilityBillType, typeof Droplets> = {
  water: Droplets,
  electricity: Zap,
  gas: Flame,
};

interface UtilityBillUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: PropertyRef | null;
}

function defaultMonthValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function filterDecimalInput(raw: string): string {
  const v = raw.replace(/[^\d.]/g, '');
  const parts = v.split('.');
  if (parts.length <= 1) return v;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
}

function localizeValidationError(message: string, t: ReturnType<typeof useLocale>['utilityBillT']): string {
  if (message === '請選擇至少一個檔案') return t.valNoFiles;
  const tooMany = message.match(/^每次最多上傳 (\d+) 個檔案$/);
  if (tooMany) return t.format('valTooMany', { max: tooMany[1] });
  const monthLimit = message.match(/^此月份已有 (\d+) 個檔案，最多共 (\d+) 個$/);
  if (monthLimit) return t.format('valMonthLimit', { existing: monthLimit[1], max: monthLimit[2] });
  if (message.includes('500MB')) return t.valFileTooBig;
  if (message.includes('不能為空')) return t.valInvalidType;
  return message;
}

export function UtilityBillUploadDialog({ open, onOpenChange, property }: UtilityBillUploadDialogProps) {
  const { utilityBillT: t, localizePropertyTitle } = useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const [billMonth, setBillMonth] = useState(defaultMonthValue);
  const [billType, setBillType] = useState<UtilityBillType>('water');
  const [files, setFiles] = useState<File[]>([]);
  const [tenantPayable, setTenantPayable] = useState('');
  const [saving, setSaving] = useState(false);

  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  const reset = () => {
    setBillMonth(defaultMonthValue());
    setBillType('water');
    setFiles([]);
    setTenantPayable('');
    setSaving(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFileChange = (list: FileList | null) => {
    if (!list?.length) {
      setFiles([]);
      return;
    }
    setFiles(Array.from(list).slice(0, UTILITY_BILL_MAX_FILES));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    if (!isSupabaseConfigured) {
      toast.error(t.errNoSupabase);
      return;
    }

    try {
      billMonthToDate(billMonth);
    } catch {
      toast.error(t.errMonthFormat);
      return;
    }

    const validationErr = validateUtilityBillFiles(files);
    if (validationErr) {
      toast.error(localizeValidationError(validationErr, t));
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user?.id) {
        throw new Error(t.errLogin);
      }

      const payableRaw = tenantPayable.trim();
      if (!payableRaw) {
        toast.error(t.errPayableRequired);
        setSaving(false);
        return;
      }
      const payableNum = Number(payableRaw);
      if (!Number.isFinite(payableNum) || payableNum <= 0) {
        toast.error(t.errPayablePositive);
        setSaving(false);
        return;
      }

      const count = await uploadPropertyUtilityBills(
        user.id,
        property.id,
        billMonth,
        billType,
        files,
        payableNum,
      );
      toast.success(t.format('uploadSuccess', { count }));
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.uploadFailed);
    } finally {
      setSaving(false);
    }
  };

  const confirmLabel =
    files.length > 0 ? t.format('confirmUpload', { count: files.length }) : t.format('confirmUpload', { count: 0 }).replace('（0）', '').trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(92dvh,680px)] w-[calc(100%-1rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-gray-100 px-5 pb-3 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <FileUp className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          {property ? (
            <DialogDescription className="text-left text-gray-600">
              {t.propertyLabel}
              <span className="font-medium text-gray-900">{displayTitle}</span>
              <br />
              {t.format('description', { max: UTILITY_BILL_MAX_FILES })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="utility-bill-month">{t.billMonth}</Label>
              <Input
                id="utility-bill-month"
                type="month"
                value={billMonth}
                onChange={(e) => setBillMonth(e.target.value)}
                className="block w-full"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t.billType}</Label>
              <RadioGroup value={billType} onValueChange={(v) => setBillType(v as UtilityBillType)}>
                <div className="space-y-2">
                  {BILL_TYPES.map((value) => {
                    const Icon = BILL_TYPE_ICON[value];
                    return (
                      <label
                        key={value}
                        htmlFor={`utility-type-${value}`}
                        className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-colors ${
                          billType === value ? 'border-black bg-gray-50' : 'border-gray-200'
                        }`}
                      >
                        <RadioGroupItem value={value} id={`utility-type-${value}`} className="mr-3" />
                        <Icon className="mr-2 h-5 w-5 shrink-0 text-gray-700" />
                        <div>
                          <p className="text-sm font-medium">{t.billTypeLabel(value)}</p>
                          <p className="text-xs text-gray-500">{t.billTypeHint(value)}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="utility-tenant-payable">{t.tenantPayable}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  HK$
                </span>
                <Input
                  id="utility-tenant-payable"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t.tenantPayablePlaceholder}
                  value={tenantPayable}
                  onChange={(e) => setTenantPayable(filterDecimalInput(e.target.value))}
                  className="pl-11"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">{t.tenantPayableHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="utility-bill-file">{t.format('filesLabel', { max: UTILITY_BILL_MAX_FILES })}</Label>
              <Input
                id="utility-bill-file"
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="cursor-pointer"
                onChange={(e) => handleFileChange(e.target.files)}
              />
              <p className="text-xs text-gray-500">{t.format('filesHint', { max: UTILITY_BILL_MAX_FILES })}</p>
              {files.length > 0 ? (
                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-gray-700">
                      <span className="min-w-0 truncate">
                        {f.name} <span className="text-gray-400">({formatBytes(f.size)})</span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-200"
                        onClick={() => removeFile(i)}
                        aria-label={t.removeFile}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                  <li className="border-t border-gray-200 pt-1 text-gray-500">
                    {t.format('fileSummary', {
                      count: files.length,
                      size: formatBytes(totalBytes),
                      maxSize: formatBytes(UTILITY_BILL_MAX_TOTAL_BYTES),
                    })}
                  </li>
                </ul>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t border-gray-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              className="min-h-12 w-full bg-black text-white hover:bg-gray-800"
              disabled={saving || files.length === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.uploading}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
