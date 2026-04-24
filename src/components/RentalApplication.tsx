import { useEffect, useState } from 'react';
import { Calendar, User, FileText, CreditCard, ArrowRight, FileSignature } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Property } from '../App';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';

interface RentalApplicationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  onProceedToPayment: (applicationData: ApplicationData) => void;
}

export interface ApplicationData {
  fullName: string;
  phone: string;
  email: string;
  occupation: string;
  monthlyIncome: string;
  employerName: string;
  moveInDate: Date | undefined;
  leaseDuration: string;
  numberOfOccupants: string;
  hasPets: boolean;
  emergencyContact: string;
  emergencyPhone: string;
  additionalNotes: string;
  agreedToLeaseTerms: boolean;
}

export function RentalApplication({ open, onOpenChange, property, onProceedToPayment }: RentalApplicationProps) {
  const [step, setStep] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [moveInDate, setMoveInDate] = useState<Date>();
  const [leaseDuration, setLeaseDuration] = useState('12');
  const [numberOfOccupants, setNumberOfOccupants] = useState('1');
  const [hasPets, setHasPets] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTermsAccepted(false);
  }, [open]);

  const handleSubmit = () => {
    const applicationData: ApplicationData = {
      fullName,
      phone,
      email,
      occupation: '',
      monthlyIncome: '',
      employerName: '',
      moveInDate,
      leaseDuration,
      numberOfOccupants,
      hasPets,
      emergencyContact,
      emergencyPhone,
      additionalNotes,
      agreedToLeaseTerms: termsAccepted,
    };
    onProceedToPayment(applicationData);
  };

  const isStep1Valid = fullName && phone && email;
  const isStep2Valid =
    Boolean(moveInDate) && Boolean(emergencyContact) && Boolean(emergencyPhone) && termsAccepted;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileSignature className="h-5 w-5 shrink-0" />
            線上簽約 · {property.title}
          </DialogTitle>
          <DialogDescription>
            填寫簽約人資料與租期，核對金額後支付首期（按金＋首月），以完成線上簽約手續；業主確認後租約正式生效。
          </DialogDescription>
          <div className="mt-2 flex gap-2 text-xs text-gray-500">
            <span className={step >= 1 ? 'font-medium text-gray-900' : ''}>① 簽約人資料</span>
            <span>·</span>
            <span className={step >= 2 ? 'font-medium text-gray-900' : ''}>② 租期、條款與金額</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-black' : 'bg-gray-200'}`} />
            <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-black' : 'bg-gray-200'}`} />
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <User className="h-5 w-5" />
                簽約人資料
              </h3>

              <div className="space-y-2">
                <Label htmlFor="fullName">全名 *</Label>
                <Input
                  id="fullName"
                  placeholder="請輸入全名"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">電話號碼 *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="請輸入電話號碼"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">電郵地址 *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="請輸入電郵地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupants">居住人數</Label>
                <RadioGroup value={numberOfOccupants} onValueChange={setNumberOfOccupants}>
                  <div className="flex gap-4">
                    {['1', '2', '3', '4', '5+'].map((num) => (
                      <div key={num} className="flex items-center space-x-2">
                        <RadioGroupItem value={num} id={`occupants-${num}`} />
                        <Label htmlFor={`occupants-${num}`}>{num}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>有寵物嗎？</Label>
                <RadioGroup value={hasPets ? 'yes' : 'no'} onValueChange={(v) => setHasPets(v === 'yes')}>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="pets-no" />
                      <Label htmlFor="pets-no">沒有</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="pets-yes" />
                      <Label htmlFor="pets-yes">有</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 2: Lease Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-5 w-5" />
                租期與條款
              </h3>

              <div className="space-y-2">
                <Label>入住日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="w-4 h-4 mr-2" />
                      {moveInDate ? moveInDate.toLocaleDateString('zh-HK') : '選擇日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={moveInDate}
                      onSelect={setMoveInDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>租期</Label>
                <RadioGroup value={leaseDuration} onValueChange={setLeaseDuration}>
                  <div className="grid grid-cols-2 gap-2">
                    {['6', '12', '24', '36'].map((months) => (
                      <div key={months} className="flex items-center space-x-2">
                        <RadioGroupItem value={months} id={`duration-${months}`} />
                        <Label htmlFor={`duration-${months}`}>{months} 個月</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContact">緊急聯絡人 *</Label>
                <Input
                  id="emergencyContact"
                  placeholder="請輸入緊急聯絡人姓名"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">緊急聯絡人電話 *</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  placeholder="請輸入電話號碼"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalNotes">附加說明（可選）</Label>
                <Textarea
                  id="additionalNotes"
                  placeholder="有任何特別要求或說明嗎？"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-3">
                <Checkbox
                  id="lease-terms"
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(v === true)}
                />
                <label htmlFor="lease-terms" className="cursor-pointer text-sm leading-relaxed text-gray-800">
                  本人已閱讀並同意本平台的<strong className="font-semibold">租賃與簽約條款</strong>，確認所填資料真實無誤；明白
                  <strong className="font-semibold">完成支付首期後</strong>，須待業主確認方正式生效。
                </label>
              </div>

              {/* Summary */}
              <div className="space-y-2 rounded-lg bg-gray-50 p-4">
                <h4 className="font-medium">首期應付摘要</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>每月租金</span>
                    <span>${property.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>按金（2個月）</span>
                    <span>${property.price * 2}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>首月租金</span>
                    <span>${property.price}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span>租金小計</span>
                    <span>${property.price * 3}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>平台費用 (1%)</span>
                    <span>+${Math.round(property.price * 3 * 0.01)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>代理費</span>
                    <span>$0</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>額外費用</span>
                    <span>$0</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">首期總額</span>
                    <span className="text-lg font-medium">${property.price * 3 + Math.round(property.price * 3 * 0.01)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-2 pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} className="flex-1">
                上一步
              </Button>
            )}
            {step < 2 ? (
              <Button
                onClick={handleNext}
                className="flex-1 bg-black text-white hover:bg-gray-800"
                disabled={
                  (step === 1 && !isStep1Valid) ||
                  (step === 2 && !isStep2Valid)
                }
              >
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-black text-white hover:bg-gray-800"
                disabled={!isStep2Valid}
              >
                前往支付首期
                <CreditCard className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}