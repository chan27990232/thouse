-- 註冊前由 App 呼叫：以資料庫規則檢查電郵格式，並確認 auth.users 尚無同一電郵
-- 套用：Supabase SQL Editor，或 node scripts/apply-database.mjs supabase/validate_signup_email.sql

create or replace function public.validate_signup_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_raw text := trim(coalesce(p_email, ''));
  v text := lower(v_raw);
begin
  if v_raw = '' then
    return jsonb_build_object(
      'ok', false,
      'message', '請輸入電子郵件。'::text
    );
  end if;

  if char_length(v) > 254 then
    return jsonb_build_object(
      'ok', false,
      'message', '電郵長度過長。'::text
    );
  end if;

  -- 實用格式檢查（以 DB 為準；不依賴 Supabase Dashboard 或其它 client-only 規則）
  if v !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    return jsonb_build_object(
      'ok', false,
      'message', '電郵格式不正確。'::text
    );
  end if;

  if exists (
    select 1
    from auth.users u
    where lower(trim(coalesce(u.email::text, ''))) = v
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', '此電郵已被註冊，請直接登入。'::text
    );
  end if;

  return jsonb_build_object('ok', true, 'message', null::text);
end;
$$;

revoke all on function public.validate_signup_email(text) from public;
grant execute on function public.validate_signup_email(text) to anon, authenticated;

comment on function public.validate_signup_email(text) is 'App 呼叫：註冊前檢查電郵格式與是否在 auth.users 已存在';
