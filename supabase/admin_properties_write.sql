-- 管理後台可更新租盤（與 is_app_admin 搭配，需在 admin_support 之後執行）
-- 可重跑

drop policy if exists "Admins can update all properties" on public.properties;
create policy "Admins can update all properties"
on public.properties
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());
