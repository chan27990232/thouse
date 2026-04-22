export interface Property {
  id: string;
  title: string;
  image: string;
  price: number;
  area: number;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  isFavorite: boolean;

  description?: string;
  amenities?: string[];
  district?: string;
  mtrLine?: string;
  schoolCatchment?: string;
  buildingAge?: 'new' | '5-10' | '10-20' | '20+';
  hasPrivateToilet?: boolean;
  images?: string[];
  videos?: string[];
  floorPlan?: string;
  landlordId?: string;
  status?: 'available' | 'rented' | 'maintenance';
}

