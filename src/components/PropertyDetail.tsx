import React, { useState } from 'react';
import type { Property } from '../types';
import { ContactLandlordDialog } from './ContactLandlordDialog';
import { RentalApplication } from './RentalApplication';

interface Props {
  property: Property;
  onBack: () => void;
}

export const PropertyDetail: React.FC<Props> = ({ property, onBack }) => {
  const [showContact, setShowContact] = useState(false);
  const [showApplication, setShowApplication] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative">
        <img
          src={property.image}
          alt={property.title}
          className="w-full h-72 object-cover"
        />
        <button
          type="button"
          onClick={onBack}
          className="absolute top-3 left-3 bg-white/90 px-3 py-1 rounded-full text-xs"
        >
          返回
        </button>
      </div>

      <main className="flex-1 px-4 py-4 space-y-4 pb-20">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{property.title}</h1>
            <div className="text-sm text-gray-600 mt-1">
              {property.district ?? '香港'} · 近地鐵站
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              ${property.price.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600">每月租金</div>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="border rounded-lg py-2">
            <div className="text-gray-500 text-[11px]">面積</div>
            <div className="font-semibold">{property.area} 呎</div>
          </div>
          <div className="border rounded-lg py-2">
            <div className="text-gray-500 text-[11px]">臥室</div>
            <div className="font-semibold">{property.bedrooms}</div>
          </div>
          <div className="border rounded-lg py-2">
            <div className="text-gray-500 text-[11px]">浴室</div>
            <div className="font-semibold">{property.bathrooms}</div>
          </div>
          <div className="border rounded-lg py-2">
            <div className="text-gray-500 text-[11px]">樓層</div>
            <div className="font-semibold">{property.floor} 樓</div>
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="font-semibold text-sm">物業簡介</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            精選劏房單位，交通方便，步行數分鐘即達地鐵站。鄰近商場及餐廳，生活配套齊全，適合年輕上班族及學生。
          </p>
        </section>

        <section className="space-y-1">
          <h2 className="font-semibold text-sm">配套設施</h2>
          <ul className="grid grid-cols-2 gap-1 text-sm text-gray-700">
            <li>• 冷氣</li>
            <li>• WiFi</li>
            <li>• 升降機</li>
            <li>• 24 小時保安</li>
          </ul>
        </section>
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t px-4 py-3 flex gap-3">
        <button
          type="button"
          onClick={() => setShowContact(true)}
          className="flex-1 border rounded-full py-2 text-sm"
        >
          聯絡業主
        </button>
        <button
          type="button"
          onClick={() => setShowApplication(true)}
          className="flex-1 bg-black text-white rounded-full py-2 text-sm"
        >
          立即申請
        </button>
      </div>

      {showContact && <ContactLandlordDialog onClose={() => setShowContact(false)} />}
      {showApplication && (
        <RentalApplication
          monthlyRent={property.price}
          onClose={() => setShowApplication(false)}
        />
      )}
    </div>
  );
};

