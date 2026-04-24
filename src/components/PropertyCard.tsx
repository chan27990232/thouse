import { Home, Heart } from 'lucide-react';
import { Property } from '../App';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface PropertyCardProps {
  property: Property;
  onToggleFavorite: (id: string) => void;
  onClick: () => void;
}

export function PropertyCard({ property, onToggleFavorite, onClick }: PropertyCardProps) {
  return (
    <div className="flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg">
      <div className="relative">
        <ImageWithFallback
          src={property.image}
          alt={property.title}
          className="w-full aspect-[4/3] object-cover"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(property.id);
          }}
          className="absolute top-3 right-3 bg-white p-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
        >
          <Heart className={`w-5 h-5 ${property.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
        </button>
      </div>
      
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="mb-2 line-clamp-2 min-h-12">{property.title}</h3>
        
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600 mb-3 text-sm">
          <div className="flex items-center gap-1">
            <Home className="w-4 h-4" />
            <span>{property.area} 平方呎</span>
          </div>
          <span>☆ {property.bedrooms} 臥室{property.floor}樓</span>
          <span>🚿 {property.bathrooms} 公廁</span>
        </div>
        
        <div className="mt-auto flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
          <div className="min-w-0">
            <span className="text-xl tabular-nums min-[380px]:text-2xl">${property.price}</span>
            <span className="ml-1 text-gray-500">/月</span>
          </div>
          <button
            onClick={onClick}
            className="min-h-11 w-full min-w-0 bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 min-[380px]:w-auto min-[380px]:shrink-0 min-[380px]:px-6"
            type="button"
          >
            租借
          </button>
        </div>
      </div>
    </div>
  );
}
