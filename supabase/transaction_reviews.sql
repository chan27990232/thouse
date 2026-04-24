-- 實際交易（簽約申請已核准）後，租客／業主可互評，1–5 星
-- 須在 lease_applications 與 admin_support（is_app_admin）之後執行

create table if not exists public.transaction_reviews (
  id uuid primary key default gen_random_uuid(),
  lease_application_id uuid not null references public.lease_applications (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (lease_application_id, from_user_id)
);

create index if not exists transaction_reviews_to_user_id_idx
  on public.transaction_reviews (to_user_id, created_at desc);
create index if not exists transaction_reviews_lease_id_idx
  on public.transaction_reviews (lease_application_id);

comment on table public.transaction_reviews is '簽約申請已核准後，雙方對對方的星等評價';
comment on column public.transaction_reviews.stars is '1–5，5 為滿分';

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
  if not (
    (new.from_user_id = la.tenant_id and new.to_user_id = la.landlord_id)
    or (new.from_user_id = la.landlord_id and new.to_user_id = la.tenant_id)
  ) then
    raise exception '評價方與被評方須為該筆申請的租客與業主';
  end if;
  if new.from_user_id is distinct from (select auth.uid()) then
    raise exception '僅能以自己的帳戶留言評價';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_transaction_review_validate on public.transaction_reviews;
create trigger trg_transaction_review_validate
before insert on public.transaction_reviews
for each row
execute function public.validate_transaction_review();

alter table public.transaction_reviews enable row level security;

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

drop policy if exists "Parties can read reviews on same lease" on public.transaction_reviews;
create policy "Parties can read reviews on same lease"
on public.transaction_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.lease_applications la
    where la.id = transaction_reviews.lease_application_id
      and (la.tenant_id = (select auth.uid()) or la.landlord_id = (select auth.uid()))
  )
  or to_user_id = (select auth.uid())
  or from_user_id = (select auth.uid())
);

drop policy if exists "Admins can read all transaction reviews" on public.transaction_reviews;
create policy "Admins can read all transaction reviews"
on public.transaction_reviews
for select
to authenticated
using (public.is_app_admin());

-- 公开展示用：只回傳某用戶「被給分」之平均與筆數（不含逐條內文）
create or replace function public.get_profile_star_summary(p_profile_id uuid)
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
  from public.transaction_reviews
  where to_user_id = p_profile_id
$$;

revoke all on function public.get_profile_star_summary(uuid) from public;
grant execute on function public.get_profile_star_summary(uuid) to anon, authenticated;
