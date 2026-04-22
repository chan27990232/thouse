import React, { useState } from 'react';

interface Props {
  amount: number;
  onClose: () => void;
}

export const PaymentDialog: React.FC<Props> = ({ amount, onClose }) => {
  const [method, setMethod] = useState<'card' | 'fps' | 'bank'>('card');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
      setTimeout(onClose, 1200);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-30">
      <div className="w-full max-w-mobile bg-white rounded-t-2xl p-4 space-y-3">
        {!success ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">付款</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-500"
              >
                關閉
              </button>
            </div>

            <div className="border rounded-lg p-3 bg-blue-50 text-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">應付金額</div>
                <div className="text-xl font-semibold">
                  ${amount.toLocaleString()}
                </div>
              </div>
              <div className="text-2xl">🏢</div>
            </div>

            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMethod('card')}
                className={`flex-1 border rounded-lg py-2 ${
                  method === 'card' ? 'border-black' : 'border-gray-200'
                }`}
              >
                信用卡/扣賬卡
              </button>
              <button
                type="button"
                onClick={() => setMethod('fps')}
                className={`flex-1 border rounded-lg py-2 ${
                  method === 'fps' ? 'border-black' : 'border-gray-200'
                }`}
              >
                FPS 轉數快
              </button>
              <button
                type="button"
                onClick={() => setMethod('bank')}
                className={`flex-1 border rounded-lg py-2 ${
                  method === 'bank' ? 'border-black' : 'border-gray-200'
                }`}
              >
                銀行轉賬
              </button>
            </div>

            {method === 'card' && (
              <div className="space-y-2 text-sm">
                <div>
                  <label className="block mb-1 text-xs text-gray-600">卡號</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-gray-600">
                    持卡人姓名
                  </label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block mb-1 text-xs text-gray-600">
                      到期日 (MM/YY)
                    </label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="w-24">
                    <label className="block mb-1 text-xs text-gray-600">CVV</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            )}

            {method === 'fps' && (
              <div className="space-y-2 text-sm">
                <label className="block mb-1 text-xs text-gray-600">
                  FPS 電話號碼/識別碼
                </label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-500">
                  請確保您的 FPS 帳戶有足夠餘額完成付款。
                </p>
              </div>
            )}

            {method === 'bank' && (
              <div className="space-y-2 text-sm">
                <div className="border rounded-lg p-3 bg-gray-50 text-xs space-y-1">
                  <div>銀行名稱: 匯豐銀行 (HSBC)</div>
                  <div>帳戶號碼: 123-456789-001</div>
                  <div>帳戶名稱: 簡屋有限公司</div>
                </div>
                <label className="block mb-1 text-xs text-gray-600">
                  您的銀行帳戶號碼 (選填)
                </label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={processing}
              className="w-full bg-black text-white rounded-lg py-2 text-sm mt-2 disabled:bg-gray-400"
            >
              {processing ? '處理中…' : '確認付款'}
            </button>

            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <span>🛡</span> 所有交易均採用 256 位元加密技術保護。
            </p>
          </>
        ) : (
          <div className="py-6 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <div className="font-semibold text-sm">付款成功！</div>
            <div className="text-xs text-gray-600">您的租賃申請已提交，業主將會審核。</div>
          </div>
        )}
      </div>
    </div>
  );
};

