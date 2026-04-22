import React from 'react';
import { PropertyCard } from './PropertyCard';
import type { Property } from '../types';

interface Props {
  properties: Property[];
  onLoginTenant: () => void;
  onLoginLandlord: () => void;
  onOpenProperty: (p: Property) => void;
}

export const Home: React.FC<Props> = ({
  properties,
  onLoginTenant,
  onLoginLandlord,
  onOpenProperty
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="text-2xl font-semibold tracking-wider">簡屋</div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-sm border rounded-full"
            onClick={onLoginTenant}
          >
            租客登入
          </button>
          <button
            className="px-3 py-1 text-sm border border-black text-white bg-black rounded-full"
            onClick={onLoginLandlord}
          >
            業主登入
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        <h1 className="text-xl font-semibold">熱門劏房物業</h1>
        <div className="space-y-4">
          {properties.map(p => (
            <PropertyCard
              key={p.id}
              property={p}
              onClick={() => onOpenProperty(p)}
              onToggleFavorite={() => {}}
              showFavorite={false}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

