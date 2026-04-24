create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  image text not null default '',
  price integer not null default 0,
  area integer not null default 0,
  floor integer not null default 0,
  bedrooms integer not null default 1,
  bathrooms integer not null default 1,
  district text not null default '',
  description text not null default '',
  status text not null default 'available' check (status in ('available', 'rented', 'draft', 'inactive')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.properties add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.properties add column if not exists title text not null default '';
alter table public.properties add column if not exists image text not null default '';
alter table public.properties add column if not exists price integer not null default 0;
alter table public.properties add column if not exists area integer not null default 0;
alter table public.properties add column if not exists floor integer not null default 0;
alter table public.properties add column if not exists bedrooms integer not null default 1;
alter table public.properties add column if not exists bathrooms integer not null default 1;
alter table public.properties add column if not exists district text not null default '';
alter table public.properties add column if not exists description text not null default '';
alter table public.properties add column if not exists status text not null default 'available';
alter table public.properties add column if not exists created_at timestamp with time zone not null default now();
alter table public.properties add column if not exists updated_at timestamp with time zone not null default now();

create index if not exists properties_landlord_id_idx on public.properties(landlord_id);
create index if not exists properties_status_idx on public.properties(status);
create index if not exists properties_created_at_idx on public.properties(created_at desc);

alter table public.properties enable row level security;

drop policy if exists "Public can read available properties" on public.properties;
create policy "Public can read available properties"
on public.properties
for select
to anon, authenticated
using (status in ('available', 'rented'));

drop policy if exists "Landlords can insert own properties" on public.properties;
create policy "Landlords can insert own properties"
on public.properties
for insert
to authenticated
with check (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'landlord'
  )
);

drop policy if exists "Landlords can update own properties" on public.properties;
create policy "Landlords can update own properties"
on public.properties
for update
to authenticated
using (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'landlord'
  )
)
with check (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'landlord'
  )
);

drop policy if exists "Landlords can delete own properties" on public.properties;
create policy "Landlords can delete own properties"
on public.properties
for delete
to authenticated
using (
  auth.uid() = landlord_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'landlord'
  )
);
