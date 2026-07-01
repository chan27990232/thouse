import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Shield, AlertCircle, Check, Copy, Wallet, Smartphone, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Property } from '../App';
import { ApplicationData } from './RentalApplication';
import type { PaymentRecordInput, SubmitLeaseResult } from '../lib/leaseApplications';
import { getLeaseFirstPaymentBreakdown } from '../lib/leaseFirstPayment';
import { supabase } from '../lib/supabase';
import { uploadBankTransferReceipt } from '../lib/leasePaymentReceiptUpload';
import { useLocale } from '../context/LocaleContext';
import { LOCALE_DATE_LOCALE } from '../lib/locale';

/** Served from `public/fps-payment-instructions.pdf` */
const FPS_PAYMENT_INSTRUCTIONS_PDF = '/fps-payment-instructions.pdf';

/** 租客轉數快／銀行轉賬共用收款資料（與平台財務一致） */
export const TENANT_PAYEE_BANK = '中國銀行（香港）有限公司';
export const TENANT_PAYEE_ACCOUNT_NO = '01288721037351';
export const TENANT_PAYEE_NAME = 'T-HOUSE Limited';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  applicationData: ApplicationData;
  onRecordLease: (payment: PaymentRecordInput) => Promise<SubmitLeaseResult>;
  onPaymentSuccess: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  property,
  applicationData,
  onRecordLease,
  onPaymentSuccess,
}: PaymentDialogProps) {
  const { locale, paymentT: t, localizePropertyTitle } = useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const [paymentMethod, setPaymentMethod] = useState<'fps' | 'bank'>('fps');
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [result, setResult] = useState<SubmitLeaseResult | null>(null);

  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const breakdown = getLeaseFirstPaymentBreakdown(property.price);
  const { rentalSubtotal, platformFee, total: totalAmount } = breakdown;

  useEffect(() => {
    if (!open) return;
    setPaymentComplete(false);
    setResult(null);
    setProcessing(false);
    setPaymentMethod('fps');
    setReceiptFile(null);
  }, [open]);

  const isReceiptValid = receiptFile !== null && receiptFile.size > 0;
  const isPaymentValid = isReceiptValid;

  const buildPaymentPayload = (receiptUrl: string | null): PaymentRecordInput => {
    if (paymentMethod === 'fps') {
      return { method: 'fps', bankTransferReceiptUrl: receiptUrl ?? undefined };
    }
    return { method: 'bank_transfer', bankTransferReceiptUrl: receiptUrl ?? undefined };
  };

  const handlePayment = async () => {
    if (!isPaymentValid || processing) {
      if (!isPaymentValid) {
        toast.message(t.toastUploadReceipt, { duration: 4000 });
      }
      return;
    }

    setProcessing(true);
    const tid = toast.loading(t.toastSubmitting);

    try {
      let receiptUrl: string | null = null;
      if (paymentMethod === 'fps' || paymentMethod === 'bank') {
        const {
          data: { user },
          error: uErr,
        } = await supabase.auth.getUser();
        if (uErr || !user) throw new Error(t.toastLoginForReceipt);
        if (!receiptFile) throw new Error(t.toastSelectReceipt);
        toast.loading(t.toastUploadingReceipt, { id: tid });
        receiptUrl = await uploadBankTransferReceipt(user.id, receiptFile);
      }

      toast.loading(t.toastCreatingApplication, { id: tid });
      const payload = buildPaymentPayload(receiptUrl);
      const res = await onRecordLease(payload);
      toast.success(t.toastSubmitted, { id: tid });
      setResult(res);
      setProcessing(false);
      setPaymentComplete(true);
      window.setTimeout(() => {
        onPaymentSuccess();
      }, 3200);
    } catch (err) {
      toast.dismiss(tid);
      setProcessing(false);
      toast.error(err instanceof Error ? err.message : t.toastPaymentFailed);
    }
  };

  const copyRef = async () => {
    if (!result?.paymentReference) return;
    try {
      await navigator.clipboard.writeText(result.paymentReference);
      toast.success(t.toastCopied);
    } catch {
      toast.error(t.toastCopyFailed);
    }
  };

  const payeeBox = (
    <div className="p-3 bg-white border rounded text-sm space-y-2">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="text-gray-600 shrink-0">{t.bank}</span>
        <span className="font-medium text-right">{TENANT_PAYEE_BANK}</span>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="text-gray-600 shrink-0">{t.accountName}</span>
        <span className="font-medium text-right break-all">{TENANT_PAYEE_NAME}</span>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="text-gray-600 shrink-0">{paymentMethod === 'fps' ? t.fpsAccountNo : t.accountNo}</span>
        <span className="font-mono font-medium tracking-wide text-right break-all">{TENANT_PAYEE_ACCOUNT_NO}</span>
      </div>
    </div>
  );

  if (paymentComplete && result) {
    const bankPending = result.paymentStatus === 'pending_bank';
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6 space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl">{bankPending ? t.successPendingTitle : t.successPaidTitle}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              {bankPending ? t.successPendingBody : t.successPaidBody}
            </p>

            <div className="p-4 bg-gray-50 rounded-lg space-y-3 text-left text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">{t.referenceNo}</span>
                <span className="font-mono text-xs break-all text-right max-w-[60%]">
                  {result.paymentReference}
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={copyRef}>
                <Copy className="w-4 h-4" />
                {t.copyReference}
              </Button>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.propertyLabel}</span>
                <span className="text-right font-medium">{displayTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.amountLabel}</span>
                <span className="font-semibold">HK${totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.paymentMethodResult}</span>
                <span>{t.paymentMethodLabel(result.method)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.moveInDate}</span>
                <span>{applicationData.moveInDate?.toLocaleDateString(LOCALE_DATE_LOCALE[locale])}</span>
              </div>
            </div>
            {bankPending && (
              <div className="text-left text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <p className="font-medium">{t.bankPendingNote1}</p>
                <p>{t.bankPendingNote2}</p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              {t.format('notifyHint', { email: applicationData.email })}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg space-y-3">
            <h3 className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {displayTitle}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t.monthlyRent}</span>
                <span>HK${breakdown.monthlyRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.depositTwoMonths}</span>
                <span>HK${breakdown.depositAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.firstMonthRent}</span>
                <span>HK${breakdown.firstMonthRent.toLocaleString()}</span>
              </div>
              <div className="border-t border-blue-400 pt-2 flex justify-between">
                <span>{t.rentalSubtotal}</span>
                <span>HK${rentalSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs opacity-90">
                <span>{t.platformFee}</span>
                <span>+HK${platformFee.toLocaleString()}</span>
              </div>
              <div className="border-t border-blue-400 pt-2 flex justify-between text-lg">
                <span className="font-bold">{t.totalDue}</span>
                <span className="font-bold">HK${totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">{t.paymentMethodsTitle}</p>
              <p className="text-xs mt-1">{t.paymentMethodsHint}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>{t.paymentMethodLabel}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as 'fps' | 'bank')}
            >
              <div className="space-y-2">
                <label
                  htmlFor="payment-fps"
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'fps' ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <RadioGroupItem value="fps" id="payment-fps" className="mr-3" />
                  <Smartphone className="w-5 h-5 mr-3" />
                  <div className="flex-1">
                    <p className="font-medium">{t.fpsTitle}</p>
                    <p className="text-xs text-gray-500">{t.fpsHint}</p>
                  </div>
                </label>

                <label
                  htmlFor="payment-bank"
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'bank' ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <RadioGroupItem value="bank" id="payment-bank" className="mr-3" />
                  <Building2 className="w-5 h-5 mr-3" />
                  <div className="flex-1">
                    <p className="font-medium">{t.bankTitle}</p>
                    <p className="text-xs text-gray-500">{t.bankHint}</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {paymentMethod === 'fps' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                {t.format('fpsPayInstruction', { amount: totalAmount.toLocaleString() })}
              </p>
              {payeeBox}

              <div className="space-y-2">
                <Label className="text-gray-800">{t.fpsInstructionsTitle}</Label>
                <iframe
                  title={t.fpsInstructionsIframeTitle}
                  src={`${FPS_PAYMENT_INSTRUCTIONS_PDF}#view=FitH`}
                  className="h-[min(50vh,380px)] w-full rounded-lg border border-gray-200 bg-white"
                />
                <a
                  href={FPS_PAYMENT_INSTRUCTIONS_PDF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  {t.openPdf}
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fps-receipt-file">{t.receiptUpload}</Label>
                <input
                  id="fps-receipt-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-800"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setReceiptFile(f ?? null);
                  }}
                />
                <p className="text-xs text-gray-500">{t.receiptHint}</p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{t.pendingReviewNote}</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{t.referenceNote}</p>
              </div>
            </div>
          )}

          {paymentMethod === 'bank' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                {t.format('bankPayInstruction', { amount: totalAmount.toLocaleString() })}
              </p>

              <div className="space-y-2">
                <Label>{t.payeeDetails}</Label>
                {payeeBox}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank-receipt-file">{t.receiptUpload}</Label>
                <input
                  id="bank-receipt-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-800"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setReceiptFile(f ?? null);
                  }}
                />
                <p className="text-xs text-gray-500">{t.receiptHint}</p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{t.pendingReviewNote}</p>
              </div>
            </div>
          )}

          <Button
            type="button"
            onClick={() => void handlePayment()}
            disabled={processing}
            className="w-full bg-black text-white hover:bg-gray-800 h-12 disabled:opacity-70"
          >
            {processing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.processing}
              </div>
            ) : (
              t.format('submitButton', { amount: totalAmount.toLocaleString() })
            )}
          </Button>

          {!isPaymentValid && !processing ? (
            <p className="text-xs text-center text-amber-800">
              {t.selectReceiptFirst}
            </p>
          ) : null}

          <p className="text-xs text-center text-gray-500">
            {t.termsPrefix}
            <button type="button" className="underline mx-1">
              {t.termsOfService}
            </button>
            {t.termsAnd}
            <button type="button" className="underline mx-1">
              {t.privacyPolicy}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
