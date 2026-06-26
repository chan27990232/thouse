-- 管理員註銷／恢復用戶（軟停用，釋放帳號供重新註冊）；需已套用 admin_support.sql
-- 可重跑

alter table public.profiles
  add column if not exists is_deactivated boolean not null default false;

alter table public.profiles
  add column if not exists deactivated_original_username text;

comment on column public.profiles.is_deactivated is
  '管理員設為 true 時帳戶停用（軟註銷）；false 為正常使用';

comment on column public.profiles.deactivated_original_username is
  '註銷前保留的登入帳號，供管理員恢復或稽核';

create index if not exists profiles_is_deactivated_idx
  on public.profiles (is_deactivated)
  where is_deactivated;

-- 登入／註冊查詢：略過已註銷帳戶（帳號已釋放者可重新註冊）
create or replace function public.find_auth_email_by_username(input_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(input_username)
    and not coalesce(is_deactivated, false)
  limit 1;
$$;

revoke all on function public.find_auth_email_by_username(text) from public;
grant execute on function public.find_auth_email_by_username(text) to anon, authenticated;

create or replace function public.admin_archive_deactivated_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  old_username text;
  archived_username text;
  archived_email text;
  preserved_username text;
begin
  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  select p.username, p.deactivated_original_username
  into old_username, preserved_username
  from public.profiles p
  where p.id = target_id;

  if old_username is null then
    raise exception 'profile not found';
  end if;

  if coalesce(preserved_username, '') = '' then
    preserved_username := old_username;
  end if;

  archived_username := left('x-' || replace(target_id::text, '-', ''), 32);
  archived_email := archived_username || '@thouse.local';

  update public.profiles
  set
    deactivated_original_username = preserved_username,
    username = archived_username,
    email = archived_email,
    is_deactivated = true,
    updated_at = now()
  where id = target_id;

  update auth.users
  set
    email = archived_email,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('username', archived_username)
  where id = target_id;
end;
$$;

create or replace function public.admin_reactivate_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  original_username text;
  restore_email text;
begin
  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  select p.deactivated_original_username
  into original_username
  from public.profiles p
  where p.id = target_id;

  if not coalesce((select is_deactivated from public.profiles where id = target_id), false) then
    return;
  end if;

  if coalesce(original_username, '') = '' then
    raise exception '無法恢復：未保留原始登入帳號';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(original_username)
      and p.id <> target_id
      and not coalesce(p.is_deactivated, false)
  ) then
    raise exception '原始登入帳號已被其他用戶使用，無法恢復';
  end if;

  restore_email := lower(original_username) || '@thouse.local';

  update public.profiles
  set
    username = lower(original_username),
    email = restore_email,
    is_deactivated = false,
    updated_at = now()
  where id = target_id;

  update auth.users
  set
    email = restore_email,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('username', lower(original_username))
  where id = target_id;
end;
$$;

revoke all on function public.admin_archive_deactivated_user(uuid) from public;
grant execute on function public.admin_archive_deactivated_user(uuid) to authenticated;

revoke all on function public.admin_reactivate_user(uuid) from public;
grant execute on function public.admin_reactivate_user(uuid) to authenticated;
