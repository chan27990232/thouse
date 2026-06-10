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

  UTILITY_BILL_TYPE_OPTIONS,

  type UtilityBillType,

} from '../lib/propertyUtilityBills';



type PropertyRef = { id: string; title: string };



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



export function UtilityBillUploadDialog({ open, onOpenChange, property }: UtilityBillUploadDialogProps) {

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

      toast.error('未設定 Supabase，無法上傳。');

      return;

    }



    try {

      billMonthToDate(billMonth);

    } catch {

      toast.error('月份格式不正確。');

      return;

    }



    const validationErr = validateUtilityBillFiles(files);

    if (validationErr) {

      toast.error(validationErr);

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

        throw new Error('請先登入。');

      }



      const payableRaw = tenantPayable.trim();

      if (!payableRaw) {

        toast.error('請填寫應付水電煤');

        setSaving(false);

        return;

      }

      const payableNum = Number(payableRaw);

      if (!Number.isFinite(payableNum) || payableNum <= 0) {

        toast.error('應付水電煤請填寫大於 0 的金額');

        setSaving(false);

        return;

      }



      const count = await uploadPropertyUtilityBills(

        user.id,

        property.id,

        billMonth,

        billType,

        files,

        payableNum

      );

      toast.success(`已上傳 ${count} 個水電煤單檔案，待平台審核後租客方可繳付。`);

      handleOpenChange(false);

    } catch (err) {

      toast.error(err instanceof Error ? err.message : '上傳失敗，請稍後再試。');

    } finally {

      setSaving(false);

    }

  };



  return (

    <Dialog open={open} onOpenChange={handleOpenChange}>

      <DialogContent className="max-w-md">

        <DialogHeader>

          <DialogTitle className="flex items-center gap-2">

            <FileUp className="h-5 w-5" />

            上傳每月水電煤單

          </DialogTitle>

          {property ? (

            <DialogDescription className="text-left text-gray-600">

              物業：<span className="font-medium text-gray-900">{property.title}</span>

              <br />

              請選擇帳單類型並上傳該月份帳單（可分多個 PDF 或清晰相片，每月最多 {UTILITY_BILL_MAX_FILES} 個）。

            </DialogDescription>

          ) : null}

        </DialogHeader>



        <form onSubmit={handleSubmit} className="space-y-4 pt-1">

          <div className="space-y-2">

            <Label htmlFor="utility-bill-month">帳單月份</Label>

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

            <Label>上傳帳單類型</Label>

            <RadioGroup value={billType} onValueChange={(v) => setBillType(v as UtilityBillType)}>

              <div className="space-y-2">

                {UTILITY_BILL_TYPE_OPTIONS.map((opt) => {

                  const Icon = BILL_TYPE_ICON[opt.value];

                  return (

                    <label

                      key={opt.value}

                      htmlFor={`utility-type-${opt.value}`}

                      className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-colors ${

                        billType === opt.value ? 'border-black bg-gray-50' : 'border-gray-200'

                      }`}

                    >

                      <RadioGroupItem value={opt.value} id={`utility-type-${opt.value}`} className="mr-3" />

                      <Icon className="mr-2 h-5 w-5 shrink-0 text-gray-700" />

                      <div>

                        <p className="text-sm font-medium">{opt.label}</p>

                        <p className="text-xs text-gray-500">{opt.hint}</p>

                      </div>

                    </label>

                  );

                })}

              </div>

            </RadioGroup>

          </div>



          <div className="space-y-2">

            <Label htmlFor="utility-tenant-payable">應付水電煤</Label>

            <div className="relative">

              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">

                HK$

              </span>

              <Input

                id="utility-tenant-payable"

                type="text"

                inputMode="decimal"

                autoComplete="off"

                placeholder="例如 350.50"

                value={tenantPayable}

                onChange={(e) => setTenantPayable(filterDecimalInput(e.target.value))}

                className="pl-11"

                required

              />

            </div>

            <p className="text-xs text-gray-500">

              填寫此類帳單的租客應付金額。上傳後由平台審核，通過後租客方可繳付。

            </p>

          </div>



          <div className="space-y-2">

            <Label htmlFor="utility-bill-file">檔案（最多 {UTILITY_BILL_MAX_FILES} 個）</Label>

            <Input

              id="utility-bill-file"

              type="file"

              multiple

              accept="application/pdf,image/jpeg,image/png,image/webp"

              className="cursor-pointer"

              onChange={(e) => handleFileChange(e.target.files)}

            />

            <p className="text-xs text-gray-500">

              PDF 或常見圖片格式，最多 {UTILITY_BILL_MAX_FILES} 個檔案、總大小 500MB 以內。同一月份可分批上傳，累計不超過{' '}

              {UTILITY_BILL_MAX_FILES} 個。

            </p>

            {files.length > 0 ? (

              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">

                {files.map((f, i) => (

                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-gray-700">

                    <span className="min-w-0 truncate">

                      {f.name} <span className="text-gray-400">({formatBytes(f.size)})</span>

                    </span>

                    <button

                      type="button"

                      className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-200"

                      onClick={() => removeFile(i)}

                      aria-label="移除檔案"

                    >

                      <X className="h-3.5 w-3.5" />

                    </button>

                  </li>

                ))}

                <li className="border-t border-gray-200 pt-1 text-gray-500">

                  共 {files.length} 個 · {formatBytes(totalBytes)} / {formatBytes(UTILITY_BILL_MAX_TOTAL_BYTES)}

                </li>

              </ul>

            ) : null}

          </div>



          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">

            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>

              取消

            </Button>

            <Button type="submit" className="bg-black text-white hover:bg-gray-800" disabled={saving || files.length === 0}>

              {saving ? (

                <>

                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                  上傳中…

                </>

              ) : (

                `確認上傳${files.length > 0 ? `（${files.length}）` : ''}`

              )}

            </Button>

          </div>

        </form>

      </DialogContent>

    </Dialog>

  );

}


