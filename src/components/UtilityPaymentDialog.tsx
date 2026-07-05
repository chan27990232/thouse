import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Shield, Check, Smartphone, ExternalLink, Droplets, Flame, Zap } from 'lucide-react';
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
import type { LeasePaymentSubmitMethod } from '../lib/leaseFirstPayment';
import { useLocale } from '../context/LocaleContext';
import { UTILITY_BILL_TYPE_OPTIONS, type UtilityBillType } from '../lib/propertyUtilityBills';
import {
  formatUtilityBillMonthLabel,
  formatUtilityDueLabel,
  getUtilityPaymentStatusLabel,
  isUtilityPaymentActionable,
  submitUtilityPayment,
  utilityBillTypeLabel,
  type UtilityPaymentSummary,
} from '../lib/utilityPayments';

const FPS_PAYMENT_INSTRUCTIONS_PDF = '/fps-payment-instructions.pdf';

const BILL_TYPE_ICON: Record<UtilityBillType, typeof Droplets> = {
  water: Droplets,
  electricity: Zap,
  gas: Flame,
};

interface UtilityPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: UtilityPaymentSummary[];
  onSuccess: () => void;
}

export function UtilityPaymentDialog({
  open,
  onOpenChange,
  payments,
  onSuccess,
}: UtilityPaymentDialogProps) {
  const { localizePropertyTitle } = useLocale();
  const [billType, setBillType] = useState<UtilityBillType>('water');
  const [paymentMethod, setPaymentMethod] = useState<'fps' | 'bank'>('fps');
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [completedPayment, setCompletedPayment] = useState<UtilityPaymentSummary | null>(null);

  const byType = useMemo(() => {
    const map = new Map<string, UtilityPaymentSummary>();
    for (const p of payments) {
      if (p.billType && p.billType !== 'legacy') {
        map.set(p.billType, p);
      }
    }
    return map;
  }, [payments]);

  const firstPayableType = useMemo(() => {
    for (const opt of UTILITY_BILL_TYPE_OPTIONS) {
      const p = byType.get(opt.value);
      if (p && isUtilityPaymentActionable(p)) return opt.value;
    }
    return UTILITY_BILL_TYPE_OPTIONS[0].value;
  }, [byType]);

  const activePayment = byType.get(billType) ?? null;
  const billMonthLabel = payments[0] ? formatUtilityBillMonthLabel(payments[0].billMonth) : '—';
  const propertyTitle = localizePropertyTitle(payments[0]?.propertyTitle ?? '—');

  useEffect(() => {
    if (!open) return;
    setPaymentComplete(false);
    setCompletedPayment(null);
    setProcessing(false);
    setPaymentMethod('fps');
    setReceiptFile(null);
    setBillType(firstPayableType);
  }, [open, firstPayableType, payments]);

  const isReceiptValid = receiptFile !== null && receiptFile.size > 0;
  const canPay = activePayment != null && isUtilityPaymentActionable(activePayment);

  const handlePay = async () => {
    if (!activePayment || !canPay || !isReceiptValid || processing) {
      if (!canPay) toast.message('請選擇待繳的帳單類型');
      else toast.message('請上傳轉賬截圖或電子收據', { duration: 4000 });
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

      toast.loading('提交水電煤紀錄…', { id: tid });
      await submitUtilityPayment(activePayment.id, method, receiptUrl);

      toast.success('水電煤款項已提交', { id: tid });
      setCompletedPayment(activePayment);
      setPaymentComplete(true);
      setProcessing(false);
      window.setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 2200);
    } catch (err) {
      toast.dismiss(tid);
      setProcessing(false);
      toast.error(err instanceof Error ? err.message : '無法完成繳付');
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

  if (paymentComplete && completedPayment) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl">水電煤已繳付</h2>
            <p className="text-sm text-gray-600">
              {billMonthLabel}{' '}
              {completedPayment.billType && completedPayment.billType !== 'legacy'
                ? utilityBillTypeLabel(completedPayment.billType)
                : '水電煤'}{' '}
              HK$
              {completedPayment.amount.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{' '}
              已記錄。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const displayAmount = activePayment?.amount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>繳付水電煤</DialogTitle>
          <DialogDescription>
            {propertyTitle} · {billMonthLabel}
            {activePayment ? ` · 須於 ${formatUtilityDueLabel(activePayment.dueDate)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>繳付帳單類型</Label>
            <RadioGroup value={billType} onValueChange={(v) => setBillType(v as UtilityBillType)}>
              <div className="space-y-2">
                {UTILITY_BILL_TYPE_OPTIONS.map((opt) => {
                  const Icon = BILL_TYPE_ICON[opt.value];
                  const row = byType.get(opt.value);
                  const payable = row != null && isUtilityPaymentActionable(row);
                  const paid = row?.status === 'paid';
                  const statusText = !row
                    ? '尚未上傳'
                    : paid
                      ? '已繳付'
                      : payable
                        ? `HK$${row.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : getUtilityPaymentStatusLabel(row.status);
                  return (
                    <label
                      key={opt.value}
                      htmlFor={`utility-pay-${opt.value}`}
                      className={`flex items-center rounded-lg border-2 p-3 transition-colors ${
                        !row || paid
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                          : billType === opt.value
                            ? 'cursor-pointer border-black bg-gray-50'
                            : 'cursor-pointer border-gray-200'
                      }`}
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`utility-pay-${opt.value}`}
                        className="mr-3"
                        disabled={!row || paid || !payable}
                      />
                      <Icon className="mr-2 h-5 w-5 shrink-0 text-gray-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-gray-500">{statusText}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {canPay && activePayment ? (
            <>
              <div className="space-y-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
                <div className="flex items-center gap-2">
                  <Droplets className="h-5 w-5" />
                  <span className="font-medium">
                    應繳{utilityBillTypeLabel(billType)}
                  </span>
                </div>
                <div className="text-3xl font-bold">
                  HK$
                  {displayAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </div>
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
                      htmlFor="utility-fps"
                      className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-colors ${
                        paymentMethod === 'fps' ? 'border-black bg-gray-50' : 'border-gray-200'
                      }`}
                    >
                      <RadioGroupItem value="fps" id="utility-fps" className="mr-3" />
                      <Smartphone className="mr-2 h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">轉數快 (FPS)</p>
                        <p className="text-xs text-gray-500">轉賬後上傳證明</p>
                      </div>
                    </label>
                    <label
                      htmlFor="utility-bank"
                      className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-colors ${
                        paymentMethod === 'bank' ? 'border-black bg-gray-50' : 'border-gray-200'
                      }`}
                    >
                      <RadioGroupItem value="bank" id="utility-bank" className="mr-3" />
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
                  請支付 HK$
                  {displayAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  至以下收款戶口。
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
                  <Label htmlFor="utility-receipt">轉賬截圖／收據上傳</Label>
                  <input
                    id="utility-receipt"
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
                {processing
                  ? '處理中…'
                  : `確認繳付${utilityBillTypeLabel(billType)}（HK$${displayAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}）`}
              </Button>

              {!isReceiptValid && !processing ? (
                <p className="text-center text-xs text-amber-800">請先選擇轉賬證明檔案。</p>
              ) : null}
            </>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              請選擇有待繳金額的帳單類型；已繳付或尚未上傳的類型無法提交。
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
