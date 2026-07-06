-- 租客改為對租盤評分；業主綜合評分 = 各租盤平均分的平均
-- 須在 transaction_reviews.sql 之後執行

alter table public.transaction_reviews
  add column if not exists property_id uuid references public.properties (id) on delete cascade;

create index if not exists transaction_reviews_property_id_idx
  on public.transaction_reviews (property_id, created_at desc);

comment on column public.transaction_reviews.property_id is '租客對租盤的評分；業主評租客時為 null';

-- 既有租客評價回填租盤 id
update public.transaction_reviews tr
set property_id = la.property_id
from public.lease_applications la
where la.id = tr.lease_application_id
  and tr.from_user_id = la.tenant_id
  and tr.property_id is null;

create or replace function public.validate_transaction_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  la public.lease_applications%rowtype;
begin
  select * into la
  from public.lease_applications
  where id = new.lease_application_id;
  if not found then
    raise exception 'lease_application 不存在';
  end if;
  if la.status is distinct from 'approved' then
    raise exception '僅在申請狀態為已核准 (approved) 後可留評價';
  end if;

  if new.from_user_id = la.tenant_id then
    if new.to_user_id is distinct from la.landlord_id then
      raise exception '租客評價須對應該筆申請的業主帳戶';
    end if;
    new.property_id := la.property_id;
  elsif new.from_user_id = la.landlord_id then
    if new.to_user_id is distinct from la.tenant_id then
      raise exception '業主評價須對應該筆申請的租客';
    end if;
    new.property_id := null;
  else
    raise exception '評價方須為該筆申請的租客或業主';
  end if;

  if new.from_user_id is distinct from (select auth.uid()) then
    raise exception '僅能以自己的帳戶留言評價';
  end if;
  return new;
end;
$$;

drop policy if exists "Users insert own transaction reviews" on public.transaction_reviews;
create policy "Users insert own transaction reviews"
on public.transaction_reviews
for insert
to authenticated
with check (
  from_user_id = (select auth.uid())
  and exists (
    select 1
    from public.lease_applications la
    where la.id = lease_application_id
      and la.status = 'approved'
      and (
        (la.tenant_id = (select auth.uid()) and to_user_id = la.landlord_id)
        or (la.landlord_id = (select auth.uid()) and to_user_id = la.tenant_id)
      )
  )
);

-- 租盤評分：租客對該物業的評價平均
create or replace function public.get_property_star_summary(p_property_id uuid)
returns table(avg_stars numeric, review_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (case
      when count(*) = 0 then 0::numeric
      else round(avg(stars::numeric), 2)
    end) as avg_stars,
    count(*)::bigint as review_count
  from public.transaction_reviews tr
  join public.lease_applications la on la.id = tr.lease_application_id
  where tr.property_id = p_property_id
    and tr.from_user_id = la.tenant_id
$$;

revoke all on function public.get_property_star_summary(uuid) from public;
grant execute on function public.get_property_star_summary(uuid) to anon, authenticated;

-- 業主綜合評分：旗下各租盤平均分的平均（僅計有評價的租盤）
create or replace function public.get_landlord_composite_star_summary(p_landlord_id uuid)
returns table(avg_stars numeric, review_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with property_avgs as (
    select
      tr.property_id,
      round(avg(tr.stars::numeric), 2) as prop_avg,
      count(*)::bigint as prop_review_count
    from public.transaction_reviews tr
    join public.properties p on p.id = tr.property_id
    join public.lease_applications la on la.id = tr.lease_application_id
    where p.landlord_id = p_landlord_id
      and tr.property_id is not null
      and tr.from_user_id = la.tenant_id
    group by tr.property_id
  )
  select
    coalesce(round(avg(prop_avg), 2), 0::numeric) as avg_stars,
    coalesce(sum(prop_review_count), 0::bigint) as review_count
  from property_avgs
$$;

revoke all on function public.get_landlord_composite_star_summary(uuid) from public;
grant execute on function public.get_landlord_composite_star_summary(uuid) to anon, authenticated;

comment on function public.get_landlord_composite_star_summary(uuid) is
  '業主綜合評分 = 旗下各租盤租客評分平均值的平均';
