import React from 'react';

interface Props {
  onOpenDashboard: () => void;
  onLogout: () => void;
}

export const LandlordHome: React.FC<Props> = ({ onOpenDashboard, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="text-xl font-semibold tracking-wider">簡屋</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-600">業主</span>
          <button type="button" onClick={onLogout} className="text-gray-600">
            登出
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-16 space-y-4">
        <section>
          <h2 className="text-lg font-semibold mb-2">業主管理中心</h2>
          <p className="text-sm text-gray-600">
            檢視物業總數、月收入及最新活動，並管理您的劏房物業。
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-white bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="text-xs">物業總數</div>
            <div className="text-2xl font-semibold mt-1">4</div>
          </div>
          <div className="rounded-xl p-3 text-white bg-gradient-to-r from-green-500 to-green-600">
            <div className="text-xs">月收入</div>
            <div className="text-2xl font-semibold mt-1">$13,950</div>
          </div>
          <div className="rounded-xl p-3 text-white bg-gradient-to-r from-purple-500 to-purple-600">
            <div className="text-xs">已出租</div>
            <div className="text-2xl font-semibold mt-1">2</div>
          </div>
          <div className="rounded-xl p-3 text-white bg-gradient-to-r from-orange-500 to-orange-600">
            <div className="text-xs">可出租</div>
            <div className="text-2xl font-semibold mt-1">1</div>
          </div>
        </section>

        <section className="space-y-2">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="w-full bg-black text-white rounded-lg py-2 text-sm"
          >
            進入管理中心
          </button>
        </section>
      </main>
    </div>
  );
};

