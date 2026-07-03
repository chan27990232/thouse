-- 聊天對話用：讀取對方的顯示名稱與 username（security definer，繞過 RLS）
drop function if exists public.get_public_chat_profile(uuid);

create or replace function public.get_public_chat_profile(profile_id uuid)
returns table (
  full_name text,
  username text,
  salutation text,
  role text
)
language sql
security definer
set search_path = public
as $$
  select
    p.full_name,
    p.username,
    p.salutation,
    p.role
  from public.profiles p
  where p.id = profile_id
  limit 1;
$$;

revoke all on function public.get_public_chat_profile(uuid) from public;
grant execute on function public.get_public_chat_profile(uuid) to anon, authenticated;
