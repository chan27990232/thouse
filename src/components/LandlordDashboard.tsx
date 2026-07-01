import React from 'react';
import { useLocale } from '../context/LocaleContext';

interface Props {
  onBack: () => void;
}

export const LandlordDashboard: React.FC<Props> = ({ onBack }) => {
  const { commonT, landlordT, landlordWalletT } = useLocale();

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:gap-3">
        <button type="button" onClick={onBack} className="text-sm text-gray-600">
          {commonT.back}
        </button>
        <div className="text-sm text-gray-500">{landlordT.dashboardTitle}</div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        <section className="rounded-xl bg-gradient-to-r from-black to-gray-800 text-white p-4 space-y-1">
          <div className="text-xs text-gray-300">{landlordWalletT.availableBalance}</div>
          <div className="text-3xl font-semibold">—</div>
          <p className="text-xs text-gray-400">{landlordT.dashboardWithdrawalComing}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{landlordT.dashboardManageFeatures}</h2>
          <div className="space-y-2 text-sm">
            <div className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">{landlordT.dashboardUploadProperty}</div>
                <div className="text-xs text-gray-600">{landlordT.dashboardUploadPropertyHint}</div>
              </div>
              <div className="text-xl">⬆️</div>
            </div>
            <div className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">{landlordT.dashboardUploadBills}</div>
                <div className="text-xs text-gray-600">{landlordT.dashboardUploadBillsHint}</div>
              </div>
              <div className="text-xl">📄</div>
            </div>
            <div className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">{landlordT.dashboardDocuments}</div>
                <div className="text-xs text-gray-600">{landlordT.dashboardDocumentsHint}</div>
              </div>
              <div className="text-xl">📚</div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{landlordT.dashboardRecentActivity}</h2>
          <p className="text-xs text-gray-500">{landlordT.dashboardNoActivity}</p>
        </section>
      </main>
    </div>
  );
};
