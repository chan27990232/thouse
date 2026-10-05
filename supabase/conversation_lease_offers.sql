-- 業主在聊天室「立即簽約」上傳的租約，供該對話的租客於簽約第一步檢視。
-- 執行：node scripts/apply-database.mjs conversation_lease_offers.sql

create table if not exists public.conversation_lease_offers (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  file_url text not null,
  file_name text not null,
  landlord_full_name text not null default '',
  landlord_phone text not null default '',
  landlord_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_lease_offers_tenant_id_idx
  on public.conversation_lease_offers (tenant_id);

alter table public.conversation_lease_offers enable row level security;

drop policy if exists "Lease offers: participants can select" on public.conversation_lease_offers;
create policy "Lease offers: participants can select"
on public.conversation_lease_offers
for select
to authenticated
using (
  landlord_id = auth.uid()
  or tenant_id = auth.uid()
);

drop policy if exists "Lease offers: landlord can insert" on public.conversation_lease_offers;
create policy "Lease offers: landlord can insert"
on public.conversation_lease_offers
for insert
to authenticated
with check (
  landlord_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.landlord_id = auth.uid()
      and c.tenant_id = tenant_id
      and c.property_id = property_id
  )
);

drop policy if exists "Lease offers: landlord can update" on public.conversation_lease_offers;
create policy "Lease offers: landlord can update"
on public.conversation_lease_offers
for update
to authenticated
using (landlord_id = auth.uid())
with check (landlord_id = auth.uid());
