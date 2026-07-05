import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Shield, AlertCircle, Check, Smartphone, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  TENANT_PAYEE_ACCOUNT_NO,
  TENANT_PAYEE_BANK,
  TENANT_PAYEE_NAME,
} from './PaymentDialog';
import { supabase } from '../lib/supabase';
import { uploadBankTransferReceipt } from '../lib/leasePaymentReceiptUpload';
import { formatDeadlineLabel } from '../lib/paymentDeadlines';
import { useLocale } from '../context/LocaleContext';
import type { LeasePaymentSubmitMethod } from '../lib/leaseFirstPayment';
import { submitRentPayment, type RentPaymentSummary } from '../lib/rentPayments';

const FPS_PAYMENT_INSTRUCTIONS_PDF = '/fps-payment-instructions.pdf';

interface RentPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: RentPaymentSummary;
  onSuccess: () => void;
}

export function RentPaymentDialog({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: RentPaymentDialogProps) {
  const { localizePropertyTitle } = useLocale();
  const displayPropertyTitle = localizePropertyTitle(payment.propertyTitle);
  const [paymentMethod, setPaymentMethod] = useState<'fps' | 'bank'>('fps');
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setPaymentComplete(false);
    setProcessing(false);
    setPaymentMethod('fps');
    setReceiptFile(null);
  }, [open, payment.id]);

  const isReceiptValid = receiptFile !== null && receiptFile.size > 0;

  const handlePay = async () => {
    if (!isReceiptValid || processing) {
      toast.message('請上傳轉賬截圖或電子收據', { duration: 4000 });
      return;
    }

    setProcessing(true);
    const tid = toast.loading('正在提交…');

    try {
      const {
        data: { user },
        error: uErr,
      } = await supabase.auth.getUser();
      if (uErr || !user) throw new Error('請先登入後再上傳收據。');
      if (!receiptFile) throw new Error('請選擇轉賬證明檔案。');

      toast.loading('上傳轉賬證明中…', { id: tid });
      const receiptUrl = await uploadBankTransferReceipt(user.id, receiptFile);

      const method: LeasePaymentSubmitMethod =
        paymentMethod === 'fps' ? 'fps' : 'bank_transfer';

      toast.loading('提交租金紀錄…', { id: tid });
      await submitRentPayment(payment.id, method, receiptUrl);

      toast.success('租金已提交', { id: tid });
      setPaymentComplete(true);
      setProcessing(false);
      window.setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 2200);
    } catch (err) {
      toast.dismiss(tid);
      setProcessing(false);
      toast.error(err instanceof Error ? err.message : '無法完成繳租');
    }
  };

  const payeeBox = (
    <div className="space-y-2 rounded border bg-white p-3 text-sm">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="shrink-0 text-gray-600">銀行</span>
        <span className="text-right font-medium">{TENANT_PAYEE_BANK}</span>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="shrink-0 text-gray-600">賬戶名稱</span>
        <span className="break-all text-right font-medium">{TENANT_PAYEE_NAME}</span>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="shrink-0 text-gray-600">FPS／收款賬號</span>
        <span className="break-all text-right font-mono font-medium tracking-wide">
          {TENANT_PAYEE_ACCOUNT_NO}
        </span>
      </div>
    </div>
  );

  if (paymentComplete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl">租金已繳付</h2>
            <p className="text-sm text-gray-600">
              第 {payment.periodIndex} 期租金 HK${payment.amount.toLocaleString()} 已記錄。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>繳付每月租金</DialogTitle>
          <DialogDescription>
            {displayPropertyTitle} · 第 {payment.periodIndex} 期 · 須於{' '}
            {formatDeadlineLabel(payment.dueDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="font-medium">應繳租金</span>
            </div>
            <div className="text-3xl font-bold">HK${payment.amount.toLocaleString()}</div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <Shield className="h-5 w-5 shrink-0 text-green-600" />
            <p className="text-xs text-green-800">
              支援轉數快 (FPS) 或銀行轉賬，請上傳轉賬截圖或收據以便核對。
            </p>
          </div>

          <div className="space-y-2">
            <Label>付款方式</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as 'fps' | 'bank')}
            >
              <div className="space-y-2">
                <label
                  htmlFor="rent-fps"
                  className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-colors ${
                    paymentMethod === 'fps' ? 'border-black bg-gray-50' : 'border-gray-200'
                  }`}
                >
                  <RadioGroupItem value="fps" id="rent-fps" className="mr-3" />
                  <Smartphone className="mr-2 h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">轉數快 (FPS)</p>
                    <p className="text-xs text-gray-500">轉賬後上傳證明</p>
                  </div>
                </label>
                <label
                  htmlFor="rent-bank"
                  className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-colors ${
                    paymentMethod === 'bank' ? 'border-black bg-gray-50' : 'border-gray-200'
                  }`}
                >
                  <RadioGroupItem value="bank" id="rent-bank" className="mr-3" />
                  <Building2 className="mr-2 h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">銀行轉賬</p>
                    <p className="text-xs text-gray-500">轉賬後上傳證明</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3 rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              請支付 HK${payment.amount.toLocaleString()} 至以下收款戶口。
            </p>
            {payeeBox}

            {paymentMethod === 'fps' ? (
              <div className="space-y-2">
                <Label>FPS 付款指示</Label>
                <iframe
                  title="FPS 付款指示"
                  src={`${FPS_PAYMENT_INSTRUCTIONS_PDF}#view=FitH`}
                  className="h-[min(40vh,280px)] w-full rounded-lg border border-gray-200 bg-white"
                />
                <a
                  href={FPS_PAYMENT_INSTRUCTIONS_PDF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  開啟 PDF
                </a>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="rent-receipt">轉賬截圖／收據上傳</Label>
              <input
                id="rent-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-gray-500">必填：清晰顯示金額、日期及收款資料。</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void handlePay()}
            disabled={processing}
            className="h-12 w-full bg-black text-white hover:bg-gray-800"
          >
            {processing ? '處理中…' : `確認繳租（HK$${payment.amount.toLocaleString()}）`}
          </Button>

          {!isReceiptValid && !processing ? (
            <p className="text-center text-xs text-amber-800">請先選擇轉賬證明檔案。</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
