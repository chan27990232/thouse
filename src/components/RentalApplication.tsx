import React, { useState } from 'react';
import { PaymentDialog } from './PaymentDialog';

interface Props {
  monthlyRent: number;
  onClose: () => void;
}

export const RentalApplication: React.FC<Props> = ({ monthlyRent, onClose }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [leaseDuration, setLeaseDuration] = useState('12');
  const [showPayment, setShowPayment] = useState(false);

  const deposit = monthlyRent * 2;
  const subtotal = deposit + monthlyRent;
  const platformFee = Math.round(subtotal * 0.01);
  const total = subtotal + platformFee;

  const canNext =
    step === 1 ? fullName.trim() && phone.trim() && email.trim() : moveInDate.trim();

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-20">
        <div className="w-full max-w-mobile bg-white rounded-t-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">租賃申請</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-gray-500"
            >
              關閉
            </button>
          </div>

          <div className="flex gap-1 mb-2">
            <div
              className={`h-1 flex-1 rounded-full ${
                step === 1 ? 'bg-black' : 'bg-gray-300'
              }`}
            />
            <div
              className={`h-1 flex-1 rounded-full ${
                step === 2 ? 'bg-black' : 'bg-gray-300'
              }`}
            />
          </div>

          {step === 1 && (
            <div className="space-y-2 text-sm">
              <div>
                <label className="block mb-1 text-xs text-gray-600">全名</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1 text-xs text-gray-600">電話號碼</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1 text-xs text-gray-600">電郵地址</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2 text-sm">
              <div>
                <label className="block mb-1 text-xs text-gray-600">入住日期</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={moveInDate}
                  onChange={e => setMoveInDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1 text-xs text-gray-600">租期 (月)</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={leaseDuration}
                  onChange={e => setLeaseDuration(e.target.value)}
                >
                  <option value="6">6 個月</option>
                  <option value="12">12 個月</option>
                  <option value="24">24 個月</option>
                  <option value="36">36 個月</option>
                </select>
              </div>

              <div className="mt-2 border rounded-lg p-3 bg-gray-50 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>每月租金</span>
                  <span>${monthlyRent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>按金（2 個月）</span>
                  <span>${deposit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>首月租金</span>
                  <span>${monthlyRent.toLocaleString()}</span>
                </div>
                <hr className="my-1" />
                <div className="flex justify-between">
                  <span>租金小計</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>平台費用 (1%)</span>
                  <span>+${platformFee.toLocaleString()}</span>
                </div>
                <hr className="my-1" />
                <div className="flex justify-between font-semibold">
                  <span>首期總額</span>
                  <span>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border rounded-lg py-2 text-sm"
              >
                上一步
              </button>
            )}
            <button
              type="button"
              disabled={!canNext}
              onClick={() => {
                if (step === 1) setStep(2);
                else setShowPayment(true);
              }}
              className="flex-1 bg-black text-white rounded-lg py-2 text-sm disabled:bg-gray-400"
            >
              {step === 1 ? '下一步' : '前往付款'}
            </button>
          </div>
        </div>
      </div>

      {showPayment && (
        <PaymentDialog
          amount={total}
          onClose={() => {
            setShowPayment(false);
            onClose();
          }}
        />
      )}
    </>
  );
};

