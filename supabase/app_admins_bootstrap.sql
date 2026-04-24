-- 若尚未執行完整 admin_support.sql，至少先執行此段，讓管理後台能辨識 app_admins
-- 在 Supabase → SQL → New query 貼上後 Run

create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

drop policy if exists "Admins can read own row in app_admins" on public.app_admins;
create policy "Admins can read own row in app_admins"
on public.app_admins for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated, anon;
