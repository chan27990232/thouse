-- 實名驗證：身份證、個人資料、近三個月銀行月結單
-- 須在 tenant_verification.sql 之後執行

insert into storage.buckets (id, name, public)
values ('identity-verification', 'identity-verification', false)
on conflict (id) do update
set public = excluded.public, name = excluded.name;

create table if not exists public.identity_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('tenant', 'landlord')),
  legal_name text not null default '',
  id_number text not null default '',
  date_of_birth date,
  id_card_path text not null default '',
  bank_statement_paths text[] not null default '{}',
  bank_statement_months text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists identity_verification_submissions_user_created_idx
  on public.identity_verification_submissions (user_id, created_at desc);

comment on table public.identity_verification_submissions is
  '用戶提交的實名驗證資料（身份證、個人資料、銀行月結單）';

alter table public.identity_verification_submissions enable row level security;

drop policy if exists "Users read own identity verification submissions" on public.identity_verification_submissions;
create policy "Users read own identity verification submissions"
  on public.identity_verification_submissions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins read identity verification submissions" on public.identity_verification_submissions;
create policy "Admins read identity verification submissions"
  on public.identity_verification_submissions
  for select
  to authenticated
  using (public.is_app_admin());

-- storage: identity-verification
drop policy if exists "read identity verification for owner and admin" on storage.objects;
create policy "read identity verification for owner and admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and auth.uid() is not null
    and (
      ltrim(name, '/') like (auth.uid()::text || '/%')
      or ltrim(name, '/') = auth.uid()::text
      or public.is_app_admin()
    )
  );

drop policy if exists "insert own folder identity verification" on storage.objects;
create policy "insert own folder identity verification"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'identity-verification'
    and auth.uid() is not null
    and (
      ltrim(name, '/') like (auth.uid()::text || '/%')
      or ltrim(name, '/') = auth.uid()::text
    )
  );

drop policy if exists "update own folder identity verification" on storage.objects;
create policy "update own folder identity verification"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and auth.uid() is not null
    and (
      ltrim(name, '/') like (auth.uid()::text || '/%')
      or ltrim(name, '/') = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'identity-verification'
    and auth.uid() is not null
    and (
      ltrim(name, '/') like (auth.uid()::text || '/%')
      or ltrim(name, '/') = auth.uid()::text
    )
  );

drop policy if exists "delete own folder identity verification" on storage.objects;
create policy "delete own folder identity verification"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and auth.uid() is not null
    and (
      ltrim(name, '/') like (auth.uid()::text || '/%')
      or ltrim(name, '/') = auth.uid()::text
    )
  );

create or replace function public.submit_identity_verification(
  p_role text,
  p_legal_name text,
  p_id_number text,
  p_date_of_birth date,
  p_id_card_path text,
  p_bank_statement_paths text[],
  p_bank_statement_months text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile_role text;
  landlord_status text;
  tenant_status text;
  verified boolean;
  submission_id uuid;
  path text;
  prefix text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_role not in ('tenant', 'landlord') then
    raise exception 'invalid_role';
  end if;

  if coalesce(trim(p_legal_name), '') = '' then
    raise exception 'legal_name_required';
  end if;

  if coalesce(trim(p_id_number), '') = '' then
    raise exception 'id_number_required';
  end if;

  if p_date_of_birth is null then
    raise exception 'date_of_birth_required';
  end if;

  if coalesce(trim(p_id_card_path), '') = '' then
    raise exception 'id_card_required';
  end if;

  if coalesce(array_length(p_bank_statement_paths, 1), 0) <> 1 then
    raise exception 'bank_statements_required';
  end if;

  select p.role, p.landlord_verification_status, p.tenant_verification_status, p.is_verified
  into profile_role, landlord_status, tenant_status, verified
  from public.profiles p
  where p.id = uid;

  if profile_role is null then
    raise exception 'profile_not_found';
  end if;

  if profile_role <> p_role then
    raise exception 'role_mismatch';
  end if;

  if coalesce(verified, false) then
    raise exception 'already_verified';
  end if;

  if p_role = 'landlord' then
    if coalesce(landlord_status, 'none') not in ('none', 'rejected') then
      raise exception 'verification_not_allowed';
    end if;
  else
    if coalesce(tenant_status, 'none') not in ('none', 'rejected') then
      raise exception 'verification_not_allowed';
    end if;
  end if;

  prefix := uid::text || '/';
  if ltrim(p_id_card_path, '/') not like (prefix || '%') then
    raise exception 'invalid_id_card_path';
  end if;

  foreach path in array p_bank_statement_paths loop
    if ltrim(path, '/') not like (prefix || '%') then
      raise exception 'invalid_bank_statement_path';
    end if;
  end loop;

  insert into public.identity_verification_submissions (
    user_id,
    role,
    legal_name,
    id_number,
    date_of_birth,
    id_card_path,
    bank_statement_paths,
    bank_statement_months
  )
  values (
    uid,
    p_role,
    trim(p_legal_name),
    trim(p_id_number),
    p_date_of_birth,
    ltrim(p_id_card_path, '/'),
    array(select ltrim(x, '/') from unnest(p_bank_statement_paths) as x),
    p_bank_statement_months
  )
  returning id into submission_id;

  if p_role = 'landlord' then
    update public.profiles
    set
      landlord_verification_status = 'pending',
      landlord_verification_rejection_reason = '',
      landlord_verification_submitted_at = now(),
      updated_at = now()
    where id = uid;
  else
    update public.profiles
    set
      tenant_verification_status = 'pending',
      tenant_verification_rejection_reason = '',
      tenant_verification_submitted_at = now(),
      updated_at = now()
    where id = uid;
  end if;

  return submission_id;
end;
$$;

revoke all on function public.submit_identity_verification(text, text, text, date, text, text[], text[]) from public;
grant execute on function public.submit_identity_verification(text, text, text, date, text, text[], text[]) to authenticated;

-- 非管理員不可直接將驗證狀態改為 pending（須透過 RPC）
create or replace function public.trg_profiles_identity_verification_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_app_admin() then
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified then
    new.is_verified := old.is_verified;
  end if;

  if
    new.landlord_verification_status is distinct from old.landlord_verification_status
    or new.landlord_verification_rejection_reason is distinct from old.landlord_verification_rejection_reason
    or new.landlord_verification_submitted_at is distinct from old.landlord_verification_submitted_at
  then
    if
      new.role = 'landlord'
      and coalesce(old.landlord_verification_status, 'none') in ('none', 'rejected')
      and (not coalesce(old.is_verified, false))
      and new.landlord_verification_status = 'pending'
      and exists (
        select 1
        from public.identity_verification_submissions s
        where s.user_id = new.id
          and s.role = 'landlord'
          and s.created_at >= now() - interval '5 minutes'
      )
    then
      new.landlord_verification_rejection_reason := '';
      if new.landlord_verification_submitted_at is null then
        new.landlord_verification_submitted_at := now();
      end if;
    else
      new.landlord_verification_status := old.landlord_verification_status;
      new.landlord_verification_rejection_reason := old.landlord_verification_rejection_reason;
      new.landlord_verification_submitted_at := old.landlord_verification_submitted_at;
    end if;
  end if;

  if
    new.tenant_verification_status is distinct from old.tenant_verification_status
    or new.tenant_verification_rejection_reason is distinct from old.tenant_verification_rejection_reason
    or new.tenant_verification_submitted_at is distinct from old.tenant_verification_submitted_at
  then
    if
      new.role = 'tenant'
      and coalesce(old.tenant_verification_status, 'none') in ('none', 'rejected')
      and (not coalesce(old.is_verified, false))
      and new.tenant_verification_status = 'pending'
      and exists (
        select 1
        from public.identity_verification_submissions s
        where s.user_id = new.id
          and s.role = 'tenant'
          and s.created_at >= now() - interval '5 minutes'
      )
    then
      new.tenant_verification_rejection_reason := '';
      if new.tenant_verification_submitted_at is null then
        new.tenant_verification_submitted_at := now();
      end if;
    else
      new.tenant_verification_status := old.tenant_verification_status;
      new.tenant_verification_rejection_reason := old.tenant_verification_rejection_reason;
      new.tenant_verification_submitted_at := old.tenant_verification_submitted_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_identity_verification_guard on public.profiles;
create trigger trg_profiles_identity_verification_guard
  before update on public.profiles
  for each row
  execute function public.trg_profiles_identity_verification_guard();
