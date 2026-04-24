/**
 * 列表去重：相同標題多筆時，優先保留已填 landlord_id 的那一筆（你只在其中一筆貼 UUID 時
 * 舊邏輯會留下另一筆 null，導致列表仍顯示 —）
 * 再無則取 id 最小
 */
export function dedupePropertiesForAdmin<
  T extends { id: string; landlord_id: string | null; title: string | null }
>(rows: T[]): T[] {
  const byTitle = new Map<string, T[]>();
  for (const r of rows) {
    const t = (r.title ?? '').trim();
    const key = t || `__untitle\0${r.id}`;
    const arr = byTitle.get(key) ?? [];
    arr.push(r);
    byTitle.set(key, arr);
  }
  const out: T[] = [];
  for (const [, list] of byTitle) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const withLandlord = list.filter((x) => x.landlord_id);
    if (withLandlord.length) {
      withLandlord.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      out.push(withLandlord[0]);
    } else {
      list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      out.push(list[0]);
    }
  }
  out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return out;
}

export type LandlordInfo = { id: string; full_name: string | null; email: string | null; role: string | null; phone: string | null };
