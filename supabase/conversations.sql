-- Conversations: one thread per (property, tenant)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  tenant_display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, tenant_id)
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_conversation_id_created_at_idx
  on public.conversation_messages (conversation_id, created_at);

create index if not exists conversations_landlord_id_updated_at_idx
  on public.conversations (landlord_id, updated_at desc);

create index if not exists conversations_tenant_id_updated_at_idx
  on public.conversations (tenant_id, updated_at desc);

-- Keep conversation updated when a message arrives
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_conversation_message_touch on public.conversation_messages;
create trigger trg_conversation_message_touch
after insert on public.conversation_messages
for each row
execute function public.touch_conversation_on_message();

-- Mark messages from the other party as read (for current user)
create or replace function public.mark_conversation_messages_read (p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_messages m
  set read_at = now()
  from public.conversations c
  where m.conversation_id = p_conversation_id
    and c.id = m.conversation_id
    and m.sender_id <> auth.uid()
    and m.read_at is null
    and (c.landlord_id = auth.uid() or c.tenant_id = auth.uid());
end;
$$;

revoke all on function public.mark_conversation_messages_read (uuid) from public;
grant execute on function public.mark_conversation_messages_read (uuid) to authenticated;

-- Unread count for current user (messages sent by the other party, not read)
create or replace function public.unread_inquiry_count_for_user()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.conversation_messages m
  join public.conversations c on c.id = m.conversation_id
  where m.read_at is null
    and m.sender_id is not null
    and m.sender_id <> auth.uid()
    and (c.landlord_id = auth.uid() or c.tenant_id = auth.uid());
$$;

revoke all on function public.unread_inquiry_count_for_user() from public;
grant execute on function public.unread_inquiry_count_for_user() to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "Conversations: participants can select" on public.conversations;
create policy "Conversations: participants can select"
on public.conversations
for select
to authenticated
using (landlord_id = auth.uid() or tenant_id = auth.uid());

drop policy if exists "Conversations: tenant can start thread" on public.conversations;
create policy "Conversations: tenant can start thread"
on public.conversations
for insert
to authenticated
with check (
  tenant_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tenant')
  and exists (
    select 1
    from public.properties pr
    where pr.id = property_id
      and pr.landlord_id = landlord_id
  )
);

drop policy if exists "Messages: participants can select" on public.conversation_messages;
create policy "Messages: participants can select"
on public.conversation_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.landlord_id = auth.uid() or c.tenant_id = auth.uid())
  )
);

drop policy if exists "Messages: participants can insert" on public.conversation_messages;
create policy "Messages: participants can insert"
on public.conversation_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.landlord_id = auth.uid() or c.tenant_id = auth.uid())
  )
);
