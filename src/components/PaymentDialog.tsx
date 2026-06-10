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
import { getLeaseFirstPaymentBreakdown, getPaymentMethodLabel } from '../lib/leaseFirstPayment';
import { supabase } from '../lib/supabase';
import { uploadBankTransferReceipt } from '../lib/leasePaymentReceiptUpload';

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
        toast.message('請上傳轉賬截圖或電子收據', { duration: 4000 });
      }
      return;
    }

    setProcessing(true);
    const tid = toast.loading('正在提交…');

    try {
      let receiptUrl: string | null = null;
      if (paymentMethod === 'fps' || paymentMethod === 'bank') {
        const {
          data: { user },
          error: uErr,
        } = await supabase.auth.getUser();
        if (uErr || !user) throw new Error('請先登入後再上傳收據。');
        if (!receiptFile) throw new Error('請選擇轉賬證明檔案。');
        toast.loading('上傳轉賬證明中…', { id: tid });
        receiptUrl = await uploadBankTransferReceipt(user.id, receiptFile);
      }

      toast.loading('建立簽約申請…', { id: tid });
      const payload = buildPaymentPayload(receiptUrl);
      const res = await onRecordLease(payload);
      toast.success('已成功提交', { id: tid });
      setResult(res);
      setProcessing(false);
      setPaymentComplete(true);
      window.setTimeout(() => {
        onPaymentSuccess();
      }, 3200);
    } catch (err) {
      toast.dismiss(tid);
      setProcessing(false);
      toast.error(err instanceof Error ? err.message : '無法完成付款與簽約');
    }
  };

  const copyRef = async () => {
    if (!result?.paymentReference) return;
    try {
      await navigator.clipboard.writeText(result.paymentReference);
      toast.success('已複製參考編號');
    } catch {
      toast.error('無法複製，請手動選取');
    }
  };

  const payeeBox = (
    <div className="p-3 bg-white border rounded text-sm space-y-2">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="text-gray-600 shrink-0">銀行</span>
        <span className="font-medium text-right">{TENANT_PAYEE_BANK}</span>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="text-gray-600 shrink-0">賬戶名稱</span>
        <span className="font-medium text-right break-all">{TENANT_PAYEE_NAME}</span>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
        <span className="text-gray-600 shrink-0">{paymentMethod === 'fps' ? 'FPS／收款賬號' : '收款賬號'}</span>
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
            <h2 className="text-2xl">{bankPending ? '申請已建立' : '付款已提交'}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              {bankPending
                ? '請依照上方收款資料於 24 小時內轉賬並保留收據；我們核對入數後會更新狀態並進入後續審批流程。'
                : '簽約申請與首期付款紀錄已建立。後續流程為：平台一審 → 業主同意 → 平台複審通過後，簽約方為正式成立；請留意站內或電郵通知。'}
            </p>

            <div className="p-4 bg-gray-50 rounded-lg space-y-3 text-left text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">參考編號</span>
                <span className="font-mono text-xs break-all text-right max-w-[60%]">
                  {result.paymentReference}
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={copyRef}>
                <Copy className="w-4 h-4" />
                複製參考編號
              </Button>
              <div className="flex justify-between">
                <span className="text-gray-500">物業</span>
                <span className="text-right font-medium">{property.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">應付／記帳金額</span>
                <span className="font-semibold">HK${totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">付款方式</span>
                <span>{getPaymentMethodLabel(result.method)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">入住日期</span>
                <span>{applicationData.moveInDate?.toLocaleDateString('zh-HK')}</span>
              </div>
            </div>
            {bankPending && (
              <div className="text-left text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <p className="font-medium">轉賬時請備注參考編號前 8 碼，方便對帳。</p>
                <p>轉帳完成前，列表可能顯示「待入數」。</p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              我們會以你登入帳戶的聯絡方式（{applicationData.email}）作後續通知；並無自動寄送實體郵件。
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
            支付簽約首期
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            金額按「按金 2 個月 + 首月租金 + 平台費 1%」計算；款項及簽約以本平台記錄為準。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg space-y-3">
            <h3 className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {property.title}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>每月租金</span>
                <span>HK${breakdown.monthlyRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>按金（2 個月）</span>
                <span>HK${breakdown.depositAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>首月租金</span>
                <span>HK${breakdown.firstMonthRent.toLocaleString()}</span>
              </div>
              <div className="border-t border-blue-400 pt-2 flex justify-between">
                <span>租金小計</span>
                <span>HK${rentalSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs opacity-90">
                <span>平台費用 (1%)</span>
                <span>+HK${platformFee.toLocaleString()}</span>
              </div>
              <div className="border-t border-blue-400 pt-2 flex justify-between text-lg">
                <span className="font-bold">應付總額</span>
                <span className="font-bold">HK${totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">付款方式</p>
              <p className="text-xs mt-1">
                支援轉數快 (FPS) 或同名銀行轉賬。兩種方式均須於下方上傳轉賬截圖或收據，以便核對。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>付款方式</Label>
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
                    <p className="font-medium">轉數快 (FPS)</p>
                    <p className="text-xs text-gray-500">以 FPS ／銀行 App 轉賬至上列收款資料，並上傳證明</p>
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
                    <p className="font-medium">銀行轉賬</p>
                    <p className="text-xs text-gray-500">轉賬至上列同名戶口，並上傳證明</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {paymentMethod === 'fps' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                請於銀行 App 使用「轉數快／FPS」或同名轉賬，支付應付總額 HK$
                {totalAmount.toLocaleString()}
                。
              </p>
              {payeeBox}

              <div className="space-y-2">
                <Label className="text-gray-800">FPS 付款指示</Label>
                <iframe
                  title="FPS 付款指示"
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
                  無法預覽？在新分頁開啟／下載 PDF
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fps-receipt-file">轉賬截圖／收據上傳</Label>
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
                <p className="text-xs text-gray-500">請上傳清晰可見金額、日期及收款資料之截圖或 PDF（必填）。</p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>提交後系統會建立待核對申請；我們會比對截圖與入數紀錄，再進入平台審核流程。</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>請於備注／轉賬指示填寫參考編號（送出後會顯示）；平台會依序審核申請。</p>
              </div>
            </div>
          )}

          {paymentMethod === 'bank' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                請將應付總額 HK${totalAmount.toLocaleString()}
                {' '}
                轉賬至以下收款戶口（與 FPS 資料相同）。
              </p>

              <div className="space-y-2">
                <Label>收款資料</Label>
                {payeeBox}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank-receipt-file">轉賬截圖／收據上傳</Label>
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
                <p className="text-xs text-gray-500">請上傳清晰可見金額、日期及收款資料之截圖或 PDF（必填）。</p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>提交後系統會建立待核對申請；我們會比對截圖與入數紀錄，再進入平台審核流程。</p>
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
                處理中…
              </div>
            ) : (
              `上傳收據並建立申請（HK$${totalAmount.toLocaleString()}）`
            )}
          </Button>

          {!isPaymentValid && !processing ? (
            <p className="text-xs text-center text-amber-800">
              請先選擇轉賬證明檔案。
            </p>
          ) : null}

          <p className="text-xs text-center text-gray-500">
            點擊即表示你同意
            <button type="button" className="underline mx-1">
              服務條款
            </button>
            及
            <button type="button" className="underline mx-1">
              私隱政策
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
