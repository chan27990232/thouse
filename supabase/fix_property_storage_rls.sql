-- 修復租盤 Storage 上傳 RLS：路徑前導 / 時 split_part 會取到空字串導致失敗
-- 亦補上 anon 可讀公開主圖（首頁不帶 JWT 載圖）
-- 可重跑；於 ensure_property_storage_buckets 與 property_listing_verification 之後執行
-- 單跑：node scripts/apply-database.mjs fix_property_storage_rls.sql

-- 前綴為「本人 uuid/」的物件，name 有無前導 / 皆可比對
-- property-listing-images
drop policy if exists "public read property listing images" on storage.objects;
create policy "public read property listing images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'property-listing-images');

drop policy if exists "users own folder insert listing image" on storage.objects;
create policy "users own folder insert listing image"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-listing-images'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
);

drop policy if exists "users own folder update listing image" on storage.objects;
create policy "users own folder update listing image"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'property-listing-images'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
)
with check (
  bucket_id = 'property-listing-images'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
);

drop policy if exists "users own folder delete listing image" on storage.objects;
create policy "users own folder delete listing image"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-listing-images'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
);

-- property-verification
drop policy if exists "read property verification for owner and admin" on storage.objects;
create policy "read property verification for owner and admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-verification'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
    or public.is_app_admin()
  )
);

drop policy if exists "insert own folder property verification" on storage.objects;
create policy "insert own folder property verification"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-verification'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
);

drop policy if exists "update own folder property verification" on storage.objects;
create policy "update own folder property verification"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'property-verification'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
)
with check (
  bucket_id = 'property-verification'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
);

drop policy if exists "delete own folder property verification" on storage.objects;
create policy "delete own folder property verification"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-verification'
  and auth.uid() is not null
  and (
    ltrim(name, '/') like (auth.uid()::text || '/%')
    or ltrim(name, '/') = auth.uid()::text
  )
);
