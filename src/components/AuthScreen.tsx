import React, { useState } from 'react';

export type UserRole = 'tenant' | 'landlord';

interface Props {
  role: UserRole;
  onBack: () => void;
  onAuthSuccess: (role: UserRole) => void;
}

export const AuthScreen: React.FC<Props> = ({ role, onBack, onAuthSuccess }) => {
  const [email, setEmail] = useState('');

  const handleContinue = () => {
    if (!email) return;
    onAuthSuccess(role);
  };

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
        <div className="text-sm text-gray-500">登入</div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-1">
          <div className="text-3xl font-semibold tracking-wider">簡屋</div>
          <div className="text-lg text-gray-700">
            {role === 'tenant' ? '租客' : '業主'}
          </div>
        </div>

        <section className="space-y-3">
          <div className="space-y-1">
            <div className="font-semibold">建立帳戶</div>
            <p className="text-sm text-gray-600">輸入您的電郵地址以註冊</p>
          </div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="button"
            onClick={handleContinue}
            className="w-full bg-black text-white py-2 rounded-lg text-sm"
          >
            繼續
          </button>
        </section>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex-1 h-px bg-gray-200" />
          <span>或</span>
          <span className="flex-1 h-px bg-gray-200" />
        </div>

        <section className="space-y-2">
          <button
            type="button"
            onClick={() => onAuthSuccess(role)}
            className="w-full border py-2 rounded-lg text-sm bg-white"
          >
            Google 登入
          </button>
          <button
            type="button"
            onClick={() => onAuthSuccess(role)}
            className="w-full border py-2 rounded-lg text-sm bg-white"
          >
            Apple 登入
          </button>
        </section>

        <p className="text-[11px] text-gray-500 leading-relaxed">
          點擊繼續即表示您同意我們的服務條款及私隱政策。
        </p>
      </main>
    </div>
  );
};

