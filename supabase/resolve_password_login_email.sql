-- 管理後台：用「用戶名 (username)」或 profiles.id (UUID) 解析成 email，供 signInWithPassword 使用
-- 在 Supabase SQL Editor 執行一次（可重跑）

create or replace function public.resolve_password_login_email(p_login text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
  t text;
begin
  t := trim(p_login);
  if t = '' then
    return null;
  end if;
  if t ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    select p.email into v
    from public.profiles p
    where p.id = t::uuid
    limit 1;
    return v;
  end if;
  select p.email into v
  from public.profiles p
  where lower(p.username) = lower(t) and p.username <> ''
  limit 1;
  return v;
end;
$$;

revoke all on function public.resolve_password_login_email(text) from public;
grant execute on function public.resolve_password_login_email(text) to anon, authenticated;
