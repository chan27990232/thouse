import { useRef } from 'react';
import { Bed, Building2, Heart, Maximize2, ShowerHead } from 'lucide-react';
import { Property } from '../App';
import { useLocale } from '../context/LocaleContext';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface PropertyCardProps {
  property: Property;
  onToggleFavorite: (id: string) => void;
  onClick: () => void;
}

export function PropertyCard({ property, onToggleFavorite, onClick }: PropertyCardProps) {
  const { commonT, localizePropertyTitle } = useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const imageClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleImageClick = () => {
    if (imageClickTimer.current) clearTimeout(imageClickTimer.current);
    imageClickTimer.current = setTimeout(() => {
      onClick();
      imageClickTimer.current = null;
    }, 220);
  };

  const handleImageDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (imageClickTimer.current) {
      clearTimeout(imageClickTimer.current);
      imageClickTimer.current = null;
    }
    onToggleFavorite(property.id);
  };

  return (
    <div className="flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg">
      <div className="relative">
        <button
          type="button"
          onClick={handleImageClick}
          onDoubleClick={handleImageDoubleClick}
          className="block w-full cursor-pointer"
          aria-label={commonT.format('viewProperty', { title: displayTitle })}
        >
          <ImageWithFallback
            src={property.image}
            alt={displayTitle}
            className="aspect-[4/3] w-full object-cover"
          />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(property.id);
          }}
          className="absolute right-3 top-3 rounded-lg bg-white p-2 shadow-md transition-colors hover:bg-gray-50"
          aria-label={property.isFavorite ? commonT.removeFavorite : commonT.addFavorite}
        >
          <Heart className={`h-5 w-5 ${property.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="mb-2 line-clamp-2 min-h-12">{displayTitle}</h3>

        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Maximize2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              {property.area} {commonT.sqftUnit}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              {property.bedrooms} {commonT.bedrooms}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Building2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              {property.floor} {commonT.floorUnit}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ShowerHead className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              {property.bathrooms} {commonT.bathrooms}
            </span>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
          <div className="min-w-0">
            <span className="text-xl tabular-nums min-[380px]:text-2xl">${property.price}</span>
            <span className="ml-1 text-gray-500">{commonT.perMonth}</span>
          </div>
          <button
            onClick={onClick}
            className="min-h-11 w-full min-w-0 bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 min-[380px]:w-auto min-[380px]:shrink-0 min-[380px]:px-6"
            type="button"
          >
            {commonT.rentCta}
          </button>
        </div>
      </div>
    </div>
  );
}
