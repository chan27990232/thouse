import type { Property } from '../App';
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
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type DedupePropertyStrategy = 'smallestId' | 'newestByCreatedAt';

type DedupeableRow = {
  id: string;
  landlord_id: string | null;
  title: string | null;
  created_at?: string | null;
};

/**
 * 合併同房東、同物業名稱（title）的多筆資料（多為重複 insert，不同 id）。
 * - `smallestId`：只保留 id 字典序最小的一筆（首頁列表用，與既有行為一致）
 * - `newestByCreatedAt`：保留 `created_at` 最新的一筆；業主後台用，讓剛儲存的那一筆勝出
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
    } else {
      const tc = r.created_at ? new Date(r.created_at).getTime() : 0;
      const pc = prev.created_at ? new Date(prev.created_at).getTime() : 0;
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
    isFavorite: false,
  };
}

/** 從 Supabase 載入首頁租盤（僅真實資料；失敗回傳空陣列） */
export async function loadHomepageProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('id,landlord_id,title,image,price,area,floor,bedrooms,bathrooms')
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
