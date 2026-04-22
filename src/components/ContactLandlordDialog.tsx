import React, { useState } from 'react';

interface Props {
  onClose: () => void;
}

export const ContactLandlordDialog: React.FC<Props> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!name || !phone || !message) return;
    setSent(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-20">
      <div className="w-full max-w-mobile bg-white rounded-t-2xl p-4 space-y-3">
        {!sent ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">聯絡業主</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-500"
              >
                關閉
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <label className="block mb-1 text-xs text-gray-600">您的姓名</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1 text-xs text-gray-600">聯絡電話</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1 text-xs text-gray-600">訊息</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="您好，我對此物業感興趣，請問何時可以安排參觀？"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full bg-black text-white rounded-lg py-2 text-sm mt-2"
              >
                發送
              </button>
            </div>
          </>
        ) : (
          <div className="py-6 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <div className="font-semibold text-sm">訊息已發送！</div>
            <div className="text-xs text-gray-600">業主一般會在 1 小時內回覆。</div>
          </div>
        )}
      </div>
    </div>
  );
};

