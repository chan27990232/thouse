-- 租盤實名／佐證審核：須在 admin_support.sql 之後執行
-- 業主上傳須帶實景照片＋房產證明；管理員核准後才在首頁與可洽詢租盤中顯示

alter table public.properties
  add column if not exists proof_photo_urls jsonb not null default '[]';
alter table public.properties
  add column if not exists property_deed_url text not null default '';
alter table public.properties
  add column if not exists verification_status text;
alter table public.properties
  add column if not exists verification_rejected_reason text not null default '';
alter table public.properties
  add column if not exists verified_at timestamptz;
alter table public.properties
  add column if not exists verified_by uuid references public.profiles (id) on delete set null;

-- 歷史租盤：在套此 migration 前已存在的物業一併標為已核准
update public.properties
  set verification_status = 'approved'
  where verification_status is null
     or btrim(verification_status) = '';

-- 不合法值一併視為已核准，避免之後加 constraint 失敗
update public.properties
  set verification_status = 'approved'
  where verification_status is not null
    and verification_status not in ('pending', 'approved', 'rejected');

alter table public.properties
  drop constraint if exists properties_verification_status_check;
alter table public.properties
  add constraint properties_verification_status_check
  check (verification_status in ('pending', 'approved', 'rejected'));

alter table public.properties
  alter column verification_status set not null;
alter table public.properties
  alter column verification_status set default 'pending';

create index if not exists properties_verification_status_idx
  on public.properties (verification_status, updated_at desc);

comment on column public.properties.proof_photo_urls is '實景佐證，JSON 字串陣列：property-listing 或 private bucket 內的 storage path';
comment on column public.properties.property_deed_url is '房產證明檔 storage path 或內部路徑';
comment on column public.properties.verification_status is 'pending=待審, approved=已上架首頁, rejected=不過審';

-- ========== 觸發器：非管理員上傳一律 pending、不可自填已核准；變更證明則重送審 ==========
create or replace function public.trg_property_listing_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 僅有 JWT 的客戶端需強制審核；本機/seed 以超級用戶執行時常無 auth.uid()，不覆寫欄位
  if (select auth.uid()) is null then
    return new;
  end if;

  if public.is_app_admin() then
    if TG_OP = 'UPDATE' and new.verification_status = 'approved' and (old.verification_status is distinct from 'approved') then
      new.verified_at := coalesce(new.verified_at, now());
      new.verified_by := coalesce(new.verified_by, auth.uid());
    elsif TG_OP = 'UPDATE' and new.verification_status = 'rejected' and (old.verification_status is distinct from 'rejected') then
      new.verified_at := coalesce(new.verified_at, now());
      new.verified_by := coalesce(new.verified_by, auth.uid());
    end if;
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.verification_status := 'pending';
    new.verified_at := null;
    new.verified_by := null;
    new.verification_rejected_reason := '';
    if coalesce(jsonb_array_length(new.proof_photo_urls), 0) < 1
       or btrim(coalesce(new.property_deed_url, '')) = '' then
      raise exception '須上傳至少一張實景佐證照片及一個房產證明檔案';
    end if;
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if (new.proof_photo_urls is distinct from old.proof_photo_urls
        or btrim(coalesce(new.property_deed_url, '')) is distinct from btrim(coalesce(old.property_deed_url, ''))) then
      new.verification_status := 'pending';
      new.verification_rejected_reason := '';
      new.verified_at := null;
      new.verified_by := null;
    else
      new.verification_status := old.verification_status;
      new.verification_rejected_reason := old.verification_rejected_reason;
      new.verified_at := old.verified_at;
      new.verified_by := old.verified_by;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_property_listing_verification on public.properties;
create trigger trg_property_listing_verification
before insert or update on public.properties
for each row
execute function public.trg_property_listing_verification();

-- ========== RLS：讀取 ==========
drop policy if exists "Public can read available properties" on public.properties;
drop policy if exists "Public can read verified available properties" on public.properties;
-- 已核准且為放租／已租，所有訪客可讀
create policy "Public can read verified available properties"
on public.properties
for select
to anon, authenticated
using (
  verification_status = 'approved'
  and status in ('available', 'rented')
);

drop policy if exists "Admins can read all properties" on public.properties;
create policy "Admins can read all properties"
on public.properties
for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Landlords can read own properties" on public.properties;
create policy "Landlords can read own properties"
on public.properties
for select
to authenticated
using (
  landlord_id = (select auth.uid())
);

-- 洽詢／聊天需要讀取自己對話內的物業（可含審核中租盤）
drop policy if exists "Conversation parties can read linked properties" on public.properties;
create policy "Conversation parties can read linked properties"
on public.properties
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.property_id = properties.id
      and (c.landlord_id = (select auth.uid()) or c.tenant_id = (select auth.uid()))
  )
);

-- ========== 洽詢：僅已核准租盤可新開 thread ==========
drop policy if exists "Conversations: tenant can start thread" on public.conversations;
create policy "Conversations: tenant can start thread"
on public.conversations
for insert
to authenticated
with check (
  tenant_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'tenant'
  )
  and exists (
    select 1
    from public.properties pr
    where pr.id = property_id
      and pr.landlord_id = landlord_id
      and pr.verification_status = 'approved'
  )
);

-- ========== 簽約：僅可對已核准租盤申請（避免旁路已下架／未審盤源）==========
drop policy if exists "Tenants can insert own lease applications" on public.lease_applications;
create policy "Tenants can insert own lease applications"
on public.lease_applications
for insert
to authenticated
with check (
  tenant_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'tenant'
  )
  and landlord_id = (
    select pr.landlord_id
    from public.properties pr
    where pr.id = lease_applications.property_id
      and pr.verification_status = 'approved'
  )
);

-- ========== Storage：policy（bucket 本體由 ensure_property_storage_buckets.sql 先建立）==========
-- 本檔不 insert buckets，若單跑本檔請先執行 ensure_property_storage_buckets.sql 或整包 npm run db:apply

-- Storage 路徑：用 ltrim + like 前綴比對，避免 name 帶前導 / 時 split_part 取到空字串而違反 RLS
-- 公開主圖：anon 可讀（首頁無 JWT 拉圖）
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

-- 佐證：業主、管理員可讀；僅寫自己資料夾
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
