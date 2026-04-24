-- 業主每月上傳各物業水電煤單（存 property-verification bucket，路徑須以本人 uuid 開頭）
-- 套用：Supabase SQL Editor 或 node scripts/apply-database.mjs supabase/property_utility_bills.sql

create table if not exists public.property_utility_bills (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  bill_month date not null,
  storage_path text not null,
  original_filename text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint property_utility_bills_property_month_unique unique (property_id, bill_month),
  constraint property_utility_bills_bill_month_first_day check (extract(day from bill_month) = 1)
);

create index if not exists property_utility_bills_landlord_id_idx on public.property_utility_bills (landlord_id);
create index if not exists property_utility_bills_property_id_idx on public.property_utility_bills (property_id);

alter table public.property_utility_bills enable row level security;

drop policy if exists "Landlords read own utility bills" on public.property_utility_bills;
create policy "Landlords read own utility bills"
on public.property_utility_bills
for select
to authenticated
using (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.properties p
    where p.id = property_id
      and p.landlord_id = auth.uid()
  )
);

drop policy if exists "Landlords insert own utility bills" on public.property_utility_bills;
create policy "Landlords insert own utility bills"
on public.property_utility_bills
for insert
to authenticated
with check (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.properties p
    where p.id = property_id
      and p.landlord_id = auth.uid()
  )
);

drop policy if exists "Landlords update own utility bills" on public.property_utility_bills;
create policy "Landlords update own utility bills"
on public.property_utility_bills
for update
to authenticated
using (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.properties p
    where p.id = property_id
      and p.landlord_id = auth.uid()
  )
)
with check (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.properties p
    where p.id = property_id
      and p.landlord_id = auth.uid()
  )
);

drop policy if exists "Landlords delete own utility bills" on public.property_utility_bills;
create policy "Landlords delete own utility bills"
on public.property_utility_bills
for delete
to authenticated
using (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.properties p
    where p.id = property_id
      and p.landlord_id = auth.uid()
  )
);

comment on table public.property_utility_bills is '業主按物業、按月上傳水電煤單；檔案 path 在 property-verification bucket';
