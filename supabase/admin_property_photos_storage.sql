-- 管理員可代業主上傳／更新租盤主圖與審核相片（admin-portal 編輯租盤）
-- 須在 property_listing_verification.sql 之後執行

drop policy if exists "admin insert property listing images" on storage.objects;
create policy "admin insert property listing images"
on storage.objects for insert to authenticated
with check (bucket_id = 'property-listing-images' and public.is_app_admin());

drop policy if exists "admin update property listing images" on storage.objects;
create policy "admin update property listing images"
on storage.objects for update to authenticated
using (bucket_id = 'property-listing-images' and public.is_app_admin())
with check (bucket_id = 'property-listing-images' and public.is_app_admin());

drop policy if exists "admin delete property listing images" on storage.objects;
create policy "admin delete property listing images"
on storage.objects for delete to authenticated
using (bucket_id = 'property-listing-images' and public.is_app_admin());

drop policy if exists "admin insert property verification files" on storage.objects;
create policy "admin insert property verification files"
on storage.objects for insert to authenticated
with check (bucket_id = 'property-verification' and public.is_app_admin());

drop policy if exists "admin update property verification files" on storage.objects;
create policy "admin update property verification files"
on storage.objects for update to authenticated
using (bucket_id = 'property-verification' and public.is_app_admin())
with check (bucket_id = 'property-verification' and public.is_app_admin());

drop policy if exists "admin delete property verification files" on storage.objects;
create policy "admin delete property verification files"
on storage.objects for delete to authenticated
using (bucket_id = 'property-verification' and public.is_app_admin());
