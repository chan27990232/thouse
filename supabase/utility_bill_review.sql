-- 業主水電煤上傳須經平台審核後，租客方可繳付

alter table public.property_utility_bills
  add column if not exists review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'approved', 'rejected'));

alter table public.property_utility_bills
  add column if not exists reviewed_at timestamptz;

alter table public.property_utility_bills
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null;

alter table public.property_utility_bills
  add column if not exists review_notes text;

comment on column public.property_utility_bills.review_status is '平台審核狀態；核准後租客方可繳付水電煤';

-- 既有上傳視為已核准，避免中斷現有流程
update public.property_utility_bills
set review_status = 'approved'
where review_status = 'pending_review';

-- sync_utility_obligation_for_month 定義見 tenant_utility_obligations_bill_type.sql（勿在此覆寫舊版）

create or replace function public.sync_tenant_utility_obligation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_utility_obligation_for_month(new.property_id, new.bill_month);
  return new;
end;
$$;

-- 管理員審核某月份水電煤上傳
create or replace function public.review_utility_bills_month(
  p_property_id uuid,
  p_bill_month date,
  p_approve boolean,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_app_admin() then
    raise exception '需要管理員權限';
  end if;

  if extract(day from p_bill_month) <> 1 then
    raise exception '帳單月份須為該月 1 日';
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;

  update public.property_utility_bills
  set
    review_status = v_status,
    reviewed_at = now(),
    reviewed_by = (select auth.uid()),
    review_notes = nullif(trim(coalesce(p_notes, '')), ''),
    updated_at = now()
  where property_id = p_property_id
    and bill_month = p_bill_month;

  if not found then
    raise exception '找不到該月份水電煤上傳紀錄';
  end if;

  perform public.sync_utility_obligation_for_month(p_property_id, p_bill_month);
end;
$$;

grant execute on function public.review_utility_bills_month(uuid, date, boolean, text) to authenticated;

-- 租客可讀自己租用物業的水電煤上傳紀錄（檔案下載仍須已核准）
drop policy if exists "Tenants read approved utility bills" on public.property_utility_bills;
drop policy if exists "Tenants read utility bills for leased properties" on public.property_utility_bills;
create policy "Tenants read utility bills for leased properties"
on public.property_utility_bills for select to authenticated
using (
  exists (
    select 1
    from public.lease_applications la
    where la.property_id = property_utility_bills.property_id
      and la.tenant_id = (select auth.uid())
      and la.status = 'approved'
  )
);

-- 租客可查看已核准帳單檔案
drop policy if exists "tenant read approved utility bill files" on storage.objects;
create policy "tenant read approved utility bill files"
on storage.objects for select to authenticated
using (
  bucket_id = 'property-verification'
  and exists (
    select 1
    from public.property_utility_bills b
    join public.lease_applications la on la.property_id = b.property_id
    where b.storage_path = ltrim(name, '/')
      and b.review_status = 'approved'
      and la.tenant_id = (select auth.uid())
      and la.status = 'approved'
  )
);

