import { useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { uploadPropertyUtilityBill, billMonthToDate } from '../lib/propertyUtilityBills';

type PropertyRef = { id: string; title: string };

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

export function UtilityBillUploadDialog({ open, onOpenChange, property }: UtilityBillUploadDialogProps) {
  const [billMonth, setBillMonth] = useState(defaultMonthValue);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setBillMonth(defaultMonthValue());
    setFile(null);
    setSaving(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    if (!isSupabaseConfigured) {
      toast.error('未設定 Supabase，無法上傳。');
      return;
    }
    if (!file) {
      toast.error('請選擇水電煤單檔案（PDF 或圖片）。');
      return;
    }

    let monthOk = true;
    try {
      billMonthToDate(billMonth);
    } catch {
      monthOk = false;
    }
    if (!monthOk) {
      toast.error('月份格式不正確。');
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

      await uploadPropertyUtilityBill(user.id, property.id, billMonth, file);
      toast.success('已上傳水電煤單。');
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
              請上傳該月份之水費、電費、煤氣帳單（合併一個 PDF 或清晰相片均可）。
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
            <Label htmlFor="utility-bill-file">檔案</Label>
            <Input
              id="utility-bill-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-gray-500">PDF 或常見圖片格式，單檔最大約 12MB。同一物業、同一月份再次上傳會覆寫舊檔。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button
              type="submit"
              className="bg-black text-white hover:bg-gray-800"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上傳中…
                </>
              ) : (
                '確認上傳'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
