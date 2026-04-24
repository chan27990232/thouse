-- 管理員／客服系統
-- 1) 在 Supabase SQL Editor 執行
-- 2) 手動把管理員的 profiles.id 寫入 app_admins，例如:
--    insert into public.app_admins (user_id) values ('<管理員的 uuid>');

-- ========== 管理員名冊（禁止一般使用者直接讀取；僅 is_app_admin() 於 policy 內部使用）==========
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

-- ========== 客服工單 ==========
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_messages_ticket_id_idx on public.support_messages (ticket_id, created_at);

create or replace function public.touch_support_ticket_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set updated_at = now()
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_support_message_touch on public.support_messages;
create trigger trg_support_message_touch
after insert on public.support_messages
for each row
execute function public.touch_support_ticket_on_message();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- 工單
drop policy if exists "Users create own support tickets" on public.support_tickets;
create policy "Users create own support tickets"
on public.support_tickets for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Read tickets as owner or staff" on public.support_tickets;
create policy "Read tickets as owner or staff"
on public.support_tickets for select
to authenticated
using (
  user_id = (select auth.uid()) or public.is_app_admin()
);

drop policy if exists "Staff update tickets" on public.support_tickets;
create policy "Staff update tickets"
on public.support_tickets for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- 訊息
drop policy if exists "Read messages on own ticket or staff" on public.support_messages;
create policy "Read messages on own ticket or staff"
on public.support_messages for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (t.user_id = (select auth.uid()) or public.is_app_admin())
  )
);

drop policy if exists "User or staff insert messages" on public.support_messages;
create policy "User or staff insert messages"
on public.support_messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and (
    (
      is_staff = false
      and exists (
        select 1
        from public.support_tickets t
        where t.id = ticket_id
          and t.user_id = (select auth.uid())
      )
    )
    or
    (
      is_staff = true
      and public.is_app_admin()
      and exists (select 1 from public.support_tickets t where t.id = ticket_id)
    )
  )
);

-- ========== 管理員可讀取 profiles / 物業等（監管）==========
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Admins can read all properties" on public.properties;
create policy "Admins can read all properties"
on public.properties for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Admins can read all conversations" on public.conversations;
create policy "Admins can read all conversations"
on public.conversations for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Admins can read all conversation messages" on public.conversation_messages;
create policy "Admins can read all conversation messages"
on public.conversation_messages for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Admins can read all lease applications" on public.lease_applications;
create policy "Admins can read all lease applications"
on public.lease_applications for select
to authenticated
using (public.is_app_admin());
