create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  username text not null unique,
  salutation text not null default '' check (salutation in ('', '先生', '女士')),
  phone text not null default '',
  response_time text not null default '',
  is_verified boolean not null default false,
  role text not null check (role in ('tenant', 'landlord')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists username text not null default '';
alter table public.profiles add column if not exists salutation text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists response_time text not null default '';
alter table public.profiles add column if not exists is_verified boolean not null default false;

create unique index if not exists profiles_username_lower_idx
on public.profiles (lower(username))
where username <> '';

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.find_auth_email_by_username(input_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(input_username)
  limit 1;
$$;

revoke all on function public.find_auth_email_by_username(text) from public;
grant execute on function public.find_auth_email_by_username(text) to anon, authenticated;
