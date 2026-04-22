import React, { useState } from 'react';
import type { Property } from '../types';
import { PropertyCard } from './PropertyCard';
import { Notifications } from './Notifications';

interface Props {
  properties: Property[];
  onOpenProperty: (p: Property) => void;
  onToggleFavorite: (id: string) => void;
  onLogout: () => void;
}

export const TenantHome: React.FC<Props> = ({
  properties,
  onOpenProperty,
  onToggleFavorite,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [showNotifications, setShowNotifications] = useState(false);

  const favorites = properties.filter(p => p.isFavorite);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="text-xl font-semibold tracking-wider">簡屋</div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            className="relative"
            onClick={() => setShowNotifications(true)}
          >
            通知
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full px-1">
              2
            </span>
          </button>
          <button type="button" onClick={onLogout} className="text-gray-600">
            登出
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-16">
        {activeTab === 'home' && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">推薦物業</h2>
            <div className="space-y-4">
              {properties.map(p => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  onClick={() => onOpenProperty(p)}
                  onToggleFavorite={() => onToggleFavorite(p.id)}
                />
              ))}
            </div>
          </section>
        )}

        {activeTab === 'favorites' && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">我的最愛</h2>
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 text-sm">
                <div className="text-3xl mb-2">♡</div>
                尚未收藏物業
              </div>
            ) : (
              <div className="space-y-4">
                {favorites.map(p => (
                  <PropertyCard
                    key={p.id}
                    property={p}
                    onClick={() => onOpenProperty(p)}
                    onToggleFavorite={() => onToggleFavorite(p.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t flex">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-2 text-xs ${
            activeTab === 'home' ? 'text-black border-t-2 border-black' : 'text-gray-500'
          }`}
        >
          首頁
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-2 text-xs ${
            activeTab === 'favorites'
              ? 'text-black border-t-2 border-black'
              : 'text-gray-500'
          }`}
        >
          最愛
        </button>
      </nav>

      {showNotifications && (
        <Notifications onClose={() => setShowNotifications(false)} />
      )}
    </div>
  );
};

