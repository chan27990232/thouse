import type { Property } from '../App';
import type { PropertyBuildingAge } from './propertyFilterFields';
import { buildingAgeFromBuiltYear } from './propertyFilterFields';
import { supabase } from './supabase';

/** 物業未上傳圖片時使用之佔位圖（非假房源列表） */
export const defaultPropertyImage =
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop';

interface PropertyRow {
  id: string;
  landlord_id: string | null;
  title: string | null;
  image: string | null;
  price: number | string | null;
  area: number | string | null;
  floor: number | string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  district: string | null;
  room_features?: string[] | null;
  amenities?: string[] | null;
  building_age?: string | null;
  built_year?: number | string | null;
  renovation_year?: number | string | null;
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type DedupePropertyStrategy = 'smallestId' | 'newestByCreatedAt' | 'landlordDashboard';

type DedupeableRow = {
  id: string;
  landlord_id: string | null;
  title: string | null;
  created_at?: string | null;
  status?: string | null;
};

function createdAtMs(row: DedupeableRow): number {
  return row.created_at ? new Date(row.created_at).getTime() : 0;
}

function isRentedStatus(status: string | null | undefined): boolean {
  return status === 'rented';
}

/** 業主後台：已出租優先於招租中，避免重複物業列顯示錯誤那一筆 */
function shouldReplaceForLandlordDashboard<T extends DedupeableRow>(next: T, prev: T): boolean {
  const nextRented = isRentedStatus(next.status);
  const prevRented = isRentedStatus(prev.status);
  if (nextRented !== prevRented) return nextRented;

  const tc = createdAtMs(next);
  const pc = createdAtMs(prev);
  if (tc !== pc) return tc > pc;

  return String(next.id) < String(prev.id);
}

/**
 * 合併同房東、同物業名稱（title）的多筆資料（多為重複 insert，不同 id）。
 * - `smallestId`：只保留 id 字典序最小的一筆（首頁列表用，與既有行為一致）
 * - `newestByCreatedAt`：保留 `created_at` 最新的一筆
 * - `landlordDashboard`：已出租優先，其次較新建立（業主後台用）
 */
export function dedupePropertyRows<T extends DedupeableRow>(
  rows: T[],
  strategy: DedupePropertyStrategy = 'smallestId'
): T[] {
  const byKey = new Map<string, T>();
  for (const r of rows) {
    const lid = r.landlord_id ?? '';
    const t = (r.title ?? '').trim();
    const key = t ? `${lid}\0${t}` : `__noid\0${r.id}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      continue;
    }
    if (strategy === 'smallestId') {
      if (String(r.id) < String(prev.id)) {
        byKey.set(key, r);
      }
    } else if (strategy === 'landlordDashboard') {
      if (shouldReplaceForLandlordDashboard(r, prev)) {
        byKey.set(key, r);
      }
    } else {
      const tc = createdAtMs(r);
      const pc = createdAtMs(prev);
      if (tc > pc) {
        byKey.set(key, r);
      } else if (tc === pc && String(r.id) < String(prev.id)) {
        byKey.set(key, r);
      }
    }
  }
  return Array.from(byKey.values());
}

function mapProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    landlordId: row.landlord_id ?? undefined,
    title: row.title ?? '未命名物業',
    image: row.image || defaultPropertyImage,
    price: toNumber(row.price),
    area: toNumber(row.area),
    floor: toNumber(row.floor),
    bedrooms: toNumber(row.bedrooms, 1),
    bathrooms: toNumber(row.bathrooms, 1),
    district: (row.district ?? '').trim(),
    roomFeatures: Array.isArray(row.room_features) ? row.room_features : undefined,
    amenities: Array.isArray(row.amenities) ? row.amenities : undefined,
    builtYear: (() => {
      const n = toNumber(row.built_year, NaN);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    renovationYear: (() => {
      const n = toNumber(row.renovation_year, NaN);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    buildingAge: (() => {
      const raw = (row.building_age as PropertyBuildingAge | null) ?? undefined;
      if (raw) return raw;
      const y = toNumber(row.built_year, NaN);
      if (Number.isFinite(y) && y > 0) return buildingAgeFromBuiltYear(y);
      return undefined;
    })(),
    isFavorite: false,
  };
}

/** 從 Supabase 載入首頁租盤（僅真實資料；失敗回傳空陣列） */
export async function loadHomepageProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('id,landlord_id,title,image,price,area,floor,bedrooms,bathrooms,district,room_features,amenities,building_age,built_year,renovation_year')
    .eq('verification_status', 'approved')
    .in('status', ['available', 'rented'])
    .order('id', { ascending: true });

  if (error) {
    return [];
  }

  const raw = (data ?? []) as PropertyRow[];
  const uniqueRows = dedupePropertyRows(raw, 'smallestId');
  uniqueRows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return uniqueRows.map(mapProperty);
}

/** 依 id 載入單一物業（還原瀏覽位置用） */
export async function loadPropertyById(id: string): Promise<Property | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('properties')
    .select('id,landlord_id,title,image,price,area,floor,bedrooms,bathrooms,district,room_features,amenities,building_age,built_year,renovation_year')
    .eq('id', trimmed)
    .maybeSingle();

  if (error || !data) return null;
  return mapProperty(data as PropertyRow);
}
