-- 每月租金繳付（首期後之第 2 期起）
-- period_index：2 = 入住後第 2 個月租金（第 1 個月已含於簽約首期）

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  lease_application_id uuid not null references public.lease_applications (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  period_index integer not null check (period_index >= 2),
  due_date date not null,
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'pending_bank', 'paid', 'overdue')),
  payment_method text check (payment_method is null or payment_method in ('fps', 'bank_transfer')),
  payment_reference text,
  bank_transfer_receipt_url text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint rent_payments_unique_period unique (lease_application_id, period_index)
);

create index if not exists rent_payments_tenant_due_idx
  on public.rent_payments (tenant_id, due_date, status);

create index if not exists rent_payments_lease_idx
  on public.rent_payments (lease_application_id, period_index);

comment on table public.rent_payments is '租約核准後之每月租金（第 2 期起）';
comment on column public.rent_payments.period_index is '租金期數：2=第2個月（首期已付第1個月）';

-- 為已核准租約建立下一期應繳紀錄
create or replace function public.schedule_next_rent_payment(p_lease_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease record;
  v_last record;
  v_next_period integer;
  v_next_due date;
  v_amount integer;
  v_new_id uuid;
begin
  select
    la.id,
    la.tenant_id,
    la.landlord_id,
    la.property_id,
    la.move_in_date,
    la.lease_duration_months,
    coalesce(p.price, 0)::integer as monthly_rent
  into v_lease
  from public.lease_applications la
  join public.properties p on p.id = la.property_id
  where la.id = p_lease_application_id
    and la.status = 'approved';

  if v_lease.id is null then
    return null;
  end if;

  if v_lease.monthly_rent <= 0 then
    raise exception '物業月租無效，無法排程租金';
  end if;

  select rp.period_index, rp.due_date
  into v_last
  from public.rent_payments rp
  where rp.lease_application_id = p_lease_application_id
  order by rp.period_index desc
  limit 1;

  if v_last.period_index is null then
    v_next_period := 2;
    if v_lease.move_in_date is not null then
      v_next_due := (v_lease.move_in_date + interval '1 month')::date;
    else
      v_next_due := (current_date + interval '1 month')::date;
    end if;
  else
    v_next_period := v_last.period_index + 1;
    v_next_due := (v_last.due_date + interval '1 month')::date;
  end if;

  -- 最後一期 = lease_duration_months（第 1 月已於首期繳付）
  if v_next_period > v_lease.lease_duration_months then
    return null;
  end if;

  insert into public.rent_payments (
    lease_application_id,
    tenant_id,
    landlord_id,
    property_id,
    period_index,
    due_date,
    amount,
    status
  )
  values (
    v_lease.id,
    v_lease.tenant_id,
    v_lease.landlord_id,
    v_lease.property_id,
    v_next_period,
    v_next_due,
    v_lease.monthly_rent,
    'pending'
  )
  on conflict (lease_application_id, period_index) do nothing
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- 租約核准時自動排首期每月租金
create or replace function public.on_lease_application_approved_seed_rent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.schedule_next_rent_payment(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists lease_application_approved_rent_seed on public.lease_applications;
create trigger lease_application_approved_rent_seed
after update of status on public.lease_applications
for each row
execute function public.on_lease_application_approved_seed_rent();

-- 補齊既有已核准租約
do $$
declare
  r record;
begin
  for r in
    select la.id
    from public.lease_applications la
    where la.status = 'approved'
      and not exists (
        select 1 from public.rent_payments rp where rp.lease_application_id = la.id
      )
  loop
    perform public.schedule_next_rent_payment(r.id);
  end loop;
end;
$$;

alter table public.rent_payments enable row level security;

drop policy if exists "Tenants read own rent payments" on public.rent_payments;
create policy "Tenants read own rent payments"
on public.rent_payments for select to authenticated
using (tenant_id = (select auth.uid()));

drop policy if exists "Landlords read rent payments for their properties" on public.rent_payments;
create policy "Landlords read rent payments for their properties"
on public.rent_payments for select to authenticated
using (
  landlord_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'landlord'
  )
);

drop policy if exists "Admins read all rent payments" on public.rent_payments;
create policy "Admins read all rent payments"
on public.rent_payments for select to authenticated
using (public.is_app_admin());

grant select on public.rent_payments to authenticated;
