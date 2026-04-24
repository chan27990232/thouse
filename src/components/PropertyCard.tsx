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
    <div className="h-full bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
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
        
        <div className="flex items-center justify-between mt-auto">
          <div>
            <span className="text-2xl">${property.price}</span>
            <span className="text-gray-500 ml-1">/月</span>
          </div>
          <button
            onClick={onClick}
            className="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
          >
            租借
          </button>
        </div>
      </div>
    </div>
  );
}
