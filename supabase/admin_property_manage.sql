-- 管理後台：租盤管理（水電煤單查閱、公司轉交業主租金進度）

-- 業主水電煤單：管理員唯讀
drop policy if exists "Admins read all utility bills" on public.property_utility_bills;
create policy "Admins read all utility bills"
on public.property_utility_bills for select
to authenticated
using (public.is_app_admin());

-- 公司轉交業主租金進度
alter table public.lease_applications
  add column if not exists landlord_payout_status text not null default 'pending'
    check (landlord_payout_status in ('pending', 'processing', 'paid'));

alter table public.lease_applications
  add column if not exists landlord_paid_at timestamptz;

alter table public.rent_payments
  add column if not exists landlord_payout_status text not null default 'pending'
    check (landlord_payout_status in ('pending', 'processing', 'paid'));

alter table public.rent_payments
  add column if not exists landlord_paid_at timestamptz;

alter table public.tenant_utility_obligations
  add column if not exists landlord_payout_status text not null default 'pending'
    check (landlord_payout_status in ('pending', 'processing', 'paid'));

alter table public.tenant_utility_obligations
  add column if not exists landlord_paid_at timestamptz;

comment on column public.lease_applications.landlord_payout_status is '公司是否已將簽約首期租金轉交業主';
comment on column public.rent_payments.landlord_payout_status is '公司是否已將該期租金轉交業主';
comment on column public.tenant_utility_obligations.landlord_payout_status is '公司是否已將該期水電煤轉交業主';

drop policy if exists "Admins update lease payout" on public.lease_applications;
create policy "Admins update lease payout"
on public.lease_applications for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "Admins update rent payout" on public.rent_payments;
create policy "Admins update rent payout"
on public.rent_payments for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "Admins update utility obligation payout" on public.tenant_utility_obligations;
create policy "Admins update utility obligation payout"
on public.tenant_utility_obligations for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());
