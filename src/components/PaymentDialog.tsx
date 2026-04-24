import { useEffect, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { CreditCard, Building2, Shield, Lock, AlertCircle, Smartphone, Check, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Property } from '../App';
import { ApplicationData } from './RentalApplication';
import type { PaymentRecordInput, SubmitLeaseResult } from '../lib/leaseApplications';
import {
  formatCardPanForDisplay,
  getLeaseFirstPaymentBreakdown,
  getPaymentMethodLabel,
  isCardExpiryInPast,
  luhnValid,
} from '../lib/leaseFirstPayment';

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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'fps' | 'bank'>('card');
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [result, setResult] = useState<SubmitLeaseResult | null>(null);

  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [fpsPhone, setFpsPhone] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const breakdown = getLeaseFirstPaymentBreakdown(property.price);
  const { rentalSubtotal, platformFee, total: totalAmount } = breakdown;

  useEffect(() => {
    if (!open) return;
    setPaymentComplete(false);
    setResult(null);
    setProcessing(false);
    setPaymentMethod('card');
    setCardNumber('');
    setCardName('');
    setExpiryDate('');
    setCvv('');
    setFpsPhone('');
    setBankAccount('');
  }, [open]);

  const cardDigits = cardNumber.replace(/\D/g, '');
  const isCardValid =
    cardDigits.length >= 13 &&
    cardDigits.length <= 19 &&
    luhnValid(cardDigits) &&
    cardName.trim().length >= 2 &&
    /^\d{2}\/\d{2}$/.test(expiryDate) &&
    !isCardExpiryInPast(expiryDate) &&
    cvv.length >= 3 &&
    cvv.length <= 4;

  const isFpsValid = fpsPhone.replace(/\D/g, '').length >= 8;
  const isBankValid = bankAccount.replace(/\s/g, '').length >= 8;

  const isPaymentValid =
    (paymentMethod === 'card' && isCardValid) ||
    (paymentMethod === 'fps' && isFpsValid) ||
    (paymentMethod === 'bank' && isBankValid);

  const buildPaymentPayload = (): PaymentRecordInput => {
    if (paymentMethod === 'card') {
      return { method: 'card', cardLast4: cardDigits.slice(-4) };
    }
    if (paymentMethod === 'fps') {
      return { method: 'fps' };
    }
    return { method: 'bank_transfer' };
  };

  const handlePayment = () => {
    if (!isPaymentValid || processing) return;

    if (paymentMethod === 'card') {
      if (isCardExpiryInPast(expiryDate)) {
        toast.error('信用卡已過期，請檢查到期日。');
        return;
      }
      if (!luhnValid(cardDigits)) {
        toast.error('卡號格式不正確，請檢查後再試。');
        return;
      }
    }

    setProcessing(true);
    const delayMs = paymentMethod === 'bank' ? 800 : 1800;

    window.setTimeout(() => {
      void (async () => {
        try {
          const payload = buildPaymentPayload();
          const res = await onRecordLease(payload);
          setResult(res);
          setProcessing(false);
          setPaymentComplete(true);
          window.setTimeout(() => {
            onPaymentSuccess();
          }, 3200);
        } catch (err) {
          setProcessing(false);
          toast.error(err instanceof Error ? err.message : '無法完成付款與簽約');
        }
      })();
    }, delayMs);
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
                ? '請依照下方帳戶於 24 小時內轉帳；我們核對入數後會更新狀態並通知業主。'
                : '簽約申請與首期付款記錄已建立，業主將於平台內收到通知。'}
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
                <p className="font-medium">轉帳時請備注參考編號前 8 碼，方便對帳。</p>
                <p>轉帳完成前，列表可能顯示「待入數」；請保留銀行收據。</p>
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
            <CreditCard className="w-5 h-5" />
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
              <p className="font-medium">付款安全</p>
              <p className="text-xs mt-1">正式上線可串接合規金流。目前為示範流程，卡號不會寫入完整資料到資料庫，僅存末四碼作對帳參考。</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>付款方式</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as 'card' | 'fps' | 'bank')}
            >
              <div className="space-y-2">
                <label
                  htmlFor="payment-card"
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'card' ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <RadioGroupItem value="card" id="payment-card" className="mr-3" />
                  <CreditCard className="w-5 h-5 mr-3" />
                  <div className="flex-1">
                    <p className="font-medium">信用卡 / 扣賬卡</p>
                    <p className="text-xs text-gray-500">即時記帳（示範）</p>
                  </div>
                </label>

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
                    <p className="text-xs text-gray-500">即時記帳（示範）</p>
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
                    <p className="text-xs text-gray-500">建立申請後請自行轉帳，待核對入數</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {paymentMethod === 'card' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">卡號</Label>
                <Input
                  id="cardNumber"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  value={formatCardPanForDisplay(cardNumber.replace(/\D/g, ''))}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 19) setCardNumber(value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardName">持卡人姓名</Label>
                <Input
                  id="cardName"
                  autoComplete="cc-name"
                  placeholder="CHAN TAI MAN"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">到期日 (MM/YY)</Label>
                  <Input
                    id="expiryDate"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    value={expiryDate}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 4) {
                        const formatted =
                          value.length >= 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
                        setExpiryDate(formatted);
                      }
                    }}
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 4) setCvv(value);
                    }}
                    maxLength={4}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>示範環境不會把完整卡號送往伺服器；通過 Luhn 與到期日校驗後即視為可記帳。</p>
              </div>
            </div>
          )}

          {paymentMethod === 'fps' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="fpsPhone">FPS 電話號碼 / 識別碼</Label>
                <Input
                  id="fpsPhone"
                  placeholder="與轉帳一致之識別碼"
                  value={fpsPhone}
                  onChange={(e) => setFpsPhone(e.target.value)}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>示範流程：僅作身分對應。正式上線請綁定 FPS 回調以自動對帳。</p>
              </div>
            </div>
          )}

          {paymentMethod === 'bank' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label>平台收款戶口（轉帳專用）</Label>
                <div className="p-3 bg-white border rounded text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">銀行名稱</span>
                    <span className="font-medium">匯豐銀行 (HSBC)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">帳戶號碼</span>
                    <span className="font-medium">123-456789-001</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">帳戶名稱</span>
                    <span className="font-medium">簡屋有限公司</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccount">轉出戶口／參考（至少 8 碼以便核對）</Label>
                <Input
                  id="bankAccount"
                  placeholder="你的銀行戶口號碼或轉帳參考"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>轉帳不會即時在銀行端扣本頁的「示範」按鈕；我們會先建立待入數的簽約申請，實際到帳需人手或銀行 API 核對。</p>
              </div>
            </div>
          )}

          <Button
            onClick={handlePayment}
            disabled={!isPaymentValid || processing}
            className="w-full bg-black text-white hover:bg-gray-800 h-12"
          >
            {processing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                處理中…
              </div>
            ) : paymentMethod === 'bank' ? (
              `建立申請並取得轉帳參考（HK$${totalAmount.toLocaleString()}）`
            ) : (
              `確認支付 HK$${totalAmount.toLocaleString()}`
            )}
          </Button>

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
