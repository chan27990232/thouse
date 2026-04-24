-- 租客簽約（首期）申請，業主端用於顯示「待處理申請」
-- 在 Supabase SQL Editor 執行本檔後，RLS 才會生效

create table if not exists public.lease_applications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  move_in_date date,
  lease_duration_months integer not null default 12,
  emergency_contact text not null default '',
  emergency_phone text not null default '',
  additional_notes text not null default '',
  first_payment_total integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone not null default now(),
  payment_method text check (payment_method is null or payment_method in ('card', 'fps', 'bank_transfer')),
  payment_status text check (payment_status is null or payment_status in ('succeeded', 'pending_bank', 'failed')),
  payment_reference text,
  card_last4 text,
  paid_at timestamp with time zone
);

create unique index if not exists lease_applications_payment_reference_uidx
  on public.lease_applications (payment_reference)
  where payment_reference is not null;

create index if not exists lease_applications_landlord_id_idx
  on public.lease_applications (landlord_id, status, created_at desc);
create index if not exists lease_applications_property_id_idx
  on public.lease_applications (property_id);

alter table public.lease_applications enable row level security;

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
  )
);

drop policy if exists "Landlords can read applications for their properties" on public.lease_applications;
create policy "Landlords can read applications for their properties"
on public.lease_applications
for select
to authenticated
using (
  landlord_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'landlord'
  )
);

drop policy if exists "Tenants can read own applications" on public.lease_applications;
create policy "Tenants can read own applications"
on public.lease_applications
for select
to authenticated
using (tenant_id = (select auth.uid()));
