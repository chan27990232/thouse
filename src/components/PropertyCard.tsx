import React from 'react';
import type { Property } from '../types';

interface Props {
  property: Property;
  onClick: () => void;
  onToggleFavorite: () => void;
  showFavorite?: boolean;
}

export const PropertyCard: React.FC<Props> = ({
  property,
  onClick,
  onToggleFavorite,
  showFavorite = true
}) => {
  return (
    <div
      className="border rounded-xl overflow-hidden bg-white shadow-sm cursor-pointer"
      onClick={onClick}
    >
      <div className="relative">
        <img
          src={property.image}
          alt={property.title}
          className="w-full h-48 object-cover"
        />
        {showFavorite && (
          <button
            type="button"
            className="absolute top-2 right-2 bg-white/80 rounded-full px-2 py-1 text-xs"
            onClick={e => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            {property.isFavorite ? '♥' : '♡'}
          </button>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="text-sm text-gray-500">{property.district}</div>
        <div className="font-semibold text-base line-clamp-1">{property.title}</div>
        <div className="flex text-xs text-gray-600 gap-3">
          <span>🏠 {property.area} 呎</span>
          <span>☆ {property.bedrooms}</span>
          <span>🚿 {property.bathrooms}</span>
          <span>{property.floor} 樓</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="text-lg font-bold">
            ${property.price.toLocaleString()} <span className="text-sm">/月</span>
          </div>
          <button
            type="button"
            className="px-3 py-1 text-xs bg-black text-white rounded-full"
          >
            租借
          </button>
        </div>
      </div>
    </div>
  );
};

