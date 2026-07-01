-- Inbox actions: mark all read, archive per participant.
-- Run in Supabase SQL Editor after conversations.sql.

alter table public.conversations
  add column if not exists landlord_archived_at timestamptz,
  add column if not exists tenant_archived_at timestamptz;

create or replace function public.mark_all_conversation_messages_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_messages m
  set read_at = now()
  from public.conversations c
  where c.id = m.conversation_id
    and m.read_at is null
    and m.sender_id <> auth.uid()
    and (c.landlord_id = auth.uid() or c.tenant_id = auth.uid());
end;
$$;

revoke all on function public.mark_all_conversation_messages_read() from public;
grant execute on function public.mark_all_conversation_messages_read() to authenticated;

create or replace function public.set_conversation_archived(p_conversation_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.landlord_id = auth.uid()
  ) then
    update public.conversations
    set landlord_archived_at = case when p_archived then now() else null end
    where id = p_conversation_id and landlord_id = auth.uid();
    return;
  end if;

  if exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.tenant_id = auth.uid()
  ) then
    update public.conversations
    set tenant_archived_at = case when p_archived then now() else null end
    where id = p_conversation_id and tenant_id = auth.uid();
    return;
  end if;

  raise exception '找不到對話或沒有權限';
end;
$$;

revoke all on function public.set_conversation_archived(uuid, boolean) from public;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
