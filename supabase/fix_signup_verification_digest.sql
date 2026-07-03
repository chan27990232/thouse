-- 修正 Supabase 上 pgcrypto digest 型別與 schema 問題
-- 錯誤：function digest(text, unknown) does not exist

create extension if not exists pgcrypto with schema extensions;

create or replace function public._signup_code_hash(p_email text, p_code text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(lower(trim(p_email)) || ':' || trim(p_code), 'sha256'::text), 'hex');
$$;

revoke all on function public._signup_code_hash(text, text) from public;
grant execute on function public._signup_code_hash(text, text) to service_role;

create or replace function public.store_signup_verification_code(
  p_email text,
  p_code text,
  p_ttl_minutes integer default 10
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code text := trim(coalesce(p_code, ''));
begin
  if v_email = '' or v_code = '' then
    raise exception 'email 或驗證碼不可為空';
  end if;

  if length(v_code) <> 6 or v_code !~ '^[0-9]+$' then
    raise exception '驗證碼格式不正確';
  end if;

  update public.signup_email_verification_codes
  set consumed_at = now()
  where lower(email) = v_email
    and consumed_at is null;

  insert into public.signup_email_verification_codes (email, code_hash, expires_at)
  values (
    v_email,
    public._signup_code_hash(v_email, v_code),
    now() + make_interval(mins => greatest(1, coalesce(p_ttl_minutes, 10)))
  );
end;
$$;

revoke all on function public.store_signup_verification_code(text, text, integer) from public;
grant execute on function public.store_signup_verification_code(text, text, integer) to service_role;

create or replace function public.verify_signup_verification_code(p_email text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code text := trim(coalesce(p_code, ''));
  v_id uuid;
begin
  if v_email = '' or v_code = '' then
    return false;
  end if;

  select id into v_id
  from public.signup_email_verification_codes
  where lower(email) = v_email
    and code_hash = public._signup_code_hash(v_email, v_code)
    and consumed_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_id is null then
    return false;
  end if;

  update public.signup_email_verification_codes
  set consumed_at = now()
  where id = v_id;

  return true;
end;
$$;

revoke all on function public.verify_signup_verification_code(text, text) from public;
grant execute on function public.verify_signup_verification_code(text, text) to service_role;
