import type { Property } from '../App';
import type { PropertyBuildingAge } from './propertyFilterFields';
import { buildingAgeFromBuiltYear } from './propertyFilterFields';
import { supabase } from './supabase';
import { signedUrlForVerificationPath } from './propertyMediaUpload';

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
  status?: string | null;
  created_at?: string | null;
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
  const statusRaw = (row.status ?? '').trim();
  const status =
    statusRaw === 'available' ||
    statusRaw === 'rented' ||
    statusRaw === 'draft' ||
    statusRaw === 'inactive' ||
    statusRaw === 'maintenance'
      ? statusRaw
      : undefined;

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
    status,
    createdAt: row.created_at ?? undefined,
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

function parseJsonStringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      return parseJsonStringArray(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = String(item ?? '').trim();
    if (s) out.push(s);
  }
  return out;
}

function uniqueMediaUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = url.split('?')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|$)/i;

export function isPropertyGalleryVideo(url: string): boolean {
  return VIDEO_EXT.test(url);
}

/** 詳情頁相簿：公開 gallery_urls，若尚未寫入則用實景佐證圖 */
export async function loadPropertyGallery(propertyId: string, coverImage?: string): Promise<string[]> {
  const trimmed = propertyId.trim();
  if (!trimmed) return coverImage ? [coverImage] : [];

  const { data, error } = await supabase
    .from('properties')
    .select('image, gallery_urls, proof_photo_urls')
    .eq('id', trimmed)
    .maybeSingle();

  if (error || !data) {
    return coverImage ? uniqueMediaUrls([coverImage]) : [];
  }

  const cover = String(data.image || coverImage || '').trim();
  const gallery = parseJsonStringArray(data.gallery_urls);
  if (gallery.length > 0) {
    return uniqueMediaUrls([cover, ...gallery].filter(Boolean));
  }

  const proofPaths = parseJsonStringArray(data.proof_photo_urls);
  const extras: string[] = [];
  for (const path of proofPaths) {
    if (/^https?:\/\//i.test(path)) {
      extras.push(path);
      continue;
    }
    const signed = await signedUrlForVerificationPath(path);
    if (signed) extras.push(signed);
  }

  return uniqueMediaUrls([cover, ...extras].filter(Boolean));
}

function compareHomepageProperties(a: PropertyRow, b: PropertyRow): number {
  const aRented = isRentedStatus(a.status);
  const bRented = isRentedStatus(b.status);
  if (aRented !== bRented) return aRented ? 1 : -1;

  const aCreated = createdAtMs(a);
  const bCreated = createdAtMs(b);
  if (aCreated !== bCreated) return bCreated - aCreated;

  return String(a.id).localeCompare(String(b.id));
}

/** 從 Supabase 載入首頁租盤（僅真實資料；失敗回傳空陣列） */
export async function loadHomepageProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      'id,landlord_id,title,image,price,area,floor,bedrooms,bathrooms,district,status,created_at,room_features,amenities,building_age,built_year,renovation_year',
    )
    .eq('verification_status', 'approved')
    .in('status', ['available', 'rented'])
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  const raw = (data ?? []) as PropertyRow[];
  const uniqueRows = dedupePropertyRows(raw, 'newestByCreatedAt');
  uniqueRows.sort(compareHomepageProperties);
  return uniqueRows.map(mapProperty);
}

/** 依 id 載入單一物業（還原瀏覽位置用） */
export async function loadPropertyById(id: string): Promise<Property | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('properties')
    .select(
      'id,landlord_id,title,image,price,area,floor,bedrooms,bathrooms,district,status,created_at,room_features,amenities,building_age,built_year,renovation_year',
    )
    .eq('id', trimmed)
    .maybeSingle();

  if (error || !data) return null;
  return mapProperty(data as PropertyRow);
}

const INTERNAL_ADDRESS_HEADERS = ['地址（內部）：', '地址（内部）：', 'Address (internal):'] as const;

/** 從物業 description 抽出內部地址；沒有則以地區／標題／樓層組成。 */
export function extractPropertyViewingAddress(input: {
  description?: string | null;
  title?: string | null;
  district?: string | null;
  floor?: number | string | null;
}): string {
  const description = (input.description ?? '').trim();
  for (const header of INTERNAL_ADDRESS_HEADERS) {
    const idx = description.indexOf(header);
    if (idx >= 0) {
      const block = description.slice(idx + header.length).trim();
      if (block) return block;
    }
  }

  const parts: string[] = [];
  const district = (input.district ?? '').trim();
  const title = (input.title ?? '').trim();
  const floorNum = Number(input.floor);
  if (district) parts.push(district);
  if (title) parts.push(title);
  if (Number.isFinite(floorNum) && floorNum > 0) parts.push(`${floorNum} 樓`);
  return parts.join('\n');
}

/** 載入接受睇樓預約時要發送給租客的地址文字 */
export async function loadPropertyViewingAddress(propertyId: string): Promise<string> {
  const trimmed = propertyId.trim();
  if (!trimmed) return '';

  const { data, error } = await supabase
    .from('properties')
    .select('title,district,floor,description')
    .eq('id', trimmed)
    .maybeSingle();

  if (error || !data) return '';

  return extractPropertyViewingAddress({
    description: data.description as string | null,
    title: data.title as string | null,
    district: data.district as string | null,
    floor: data.floor as number | string | null,
  });
}
