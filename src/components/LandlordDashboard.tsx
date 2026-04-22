import React from 'react';

interface Props {
  onBack: () => void;
}

export const LandlordDashboard: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-3 border-b flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-600"
        >
          返回
        </button>
        <div className="text-sm text-gray-500">業主管理中心</div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        <section className="rounded-xl bg-gradient-to-r from-black to-gray-800 text-white p-4 space-y-1">
          <div className="text-xs text-gray-300">可用餘額</div>
          <div className="text-3xl font-semibold">$12,450.50</div>
          <button
            type="button"
            className="mt-3 px-3 py-1 text-xs bg-white text-black rounded-full"
          >
            提款
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">管理功能</h2>
          <div className="space-y-2 text-sm">
            <div className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">上傳物業</div>
                <div className="text-xs text-gray-600">
                  新增照片、影片及平面圖
                </div>
              </div>
              <div className="text-xl">⬆️</div>
            </div>
            <div className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">上傳水電費單</div>
                <div className="text-xs text-gray-600">水費及電費單</div>
              </div>
              <div className="text-xl">📄</div>
            </div>
            <div className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">實用文件</div>
                <div className="text-xs text-gray-600">
                  租賃及租金追收文件範本
                </div>
              </div>
              <div className="text-xl">📚</div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">最近活動</h2>
          <ul className="space-y-2 text-xs text-gray-700">
            <li>• 新租客 陳大文 簽署了租約（2 天前）</li>
            <li>• 收到租金 $3,450 from 陳大文（5 天前）</li>
            <li>• 尖沙咀 海景單位 進入維修狀態（1 週前）</li>
          </ul>
        </section>
      </main>
    </div>
  );
};

