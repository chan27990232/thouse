-- 單獨執行：只建立租盤用 Storage bucket（解決 "Bucket not found"）
-- 在 Supabase → SQL Editor 貼上執行，或：node scripts/apply-database.mjs ensure_property_storage_buckets.sql
-- 不影響其餘 policy；若已存在則 on conflict 更新

insert into storage.buckets (id, name, public)
values
  ('property-listing-images', 'property-listing-images', true),
  ('property-verification', 'property-verification', false)
on conflict (id) do update
set
  public = excluded.public,
  name = excluded.name;
