import React from 'react';

interface Props {
  onClose: () => void;
}

export const Notifications: React.FC<Props> = ({ onClose }) => {
  const payments = [
    {
      id: '1',
      title: '租金已支付',
      amount: 3450,
      date: '2026-02-01',
      status: 'completed' as const,
      propertyTitle: '油麻地 雅賓大廈 劏房'
    },
    {
      id: '2',
      title: '按金已支付',
      amount: 6900,
      date: '2026-02-01',
      status: 'completed' as const,
      propertyTitle: '油麻地 雅賓大廈 劏房'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-30">
      <div className="w-full max-w-mobile bg-white rounded-t-2xl p-4 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">通知</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500"
          >
            關閉
          </button>
        </div>

        <div className="space-y-2 text-sm">
          {payments.map(p => (
            <div
              key={p.id}
              className="border rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold text-xs">{p.title}</div>
                <div className="text-[11px] text-gray-500">{p.propertyTitle}</div>
                <div className="text-[11px] text-gray-500 mt-1">
                  日期：{p.date}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-600">已支付</div>
                <div className="text-sm font-semibold">
                  ${p.amount.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

