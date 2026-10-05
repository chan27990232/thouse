-- Soft-delete conversation messages: keep the row, hide content in the UI.
alter table public.conversation_messages
  add column if not exists deleted_at timestamptz null;

create index if not exists conversation_messages_deleted_at_idx
  on public.conversation_messages (conversation_id, deleted_at)
  where deleted_at is not null;

create or replace function public.soft_delete_conversation_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.conversation_messages m
  set deleted_at = now()
  from public.conversations c
  where m.id = p_message_id
    and c.id = m.conversation_id
    and m.sender_id = auth.uid()
    and m.deleted_at is null
    and (c.landlord_id = auth.uid() or c.tenant_id = auth.uid())
  returning m.id into v_updated;

  if v_updated is null then
    raise exception 'message not found or not deletable';
  end if;
end;
$$;

revoke all on function public.soft_delete_conversation_message(uuid) from public;
grant execute on function public.soft_delete_conversation_message(uuid) to authenticated;
