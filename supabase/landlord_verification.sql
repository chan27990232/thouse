-- 業主實名／身分驗證（與 is_verified 聯動；需已套用 admin_support.sql 之 is_app_admin）
-- 可重跑

alter table public.profiles
  add column if not exists landlord_verification_status text not null default 'none'
    check (landlord_verification_status in ('none', 'pending', 'rejected'));

alter table public.profiles
  add column if not exists landlord_verification_rejection_reason text not null default '';

alter table public.profiles
  add column if not exists landlord_verification_submitted_at timestamptz;

comment on column public.profiles.landlord_verification_status is
  'none=未申請, pending=待審, rejected=已駁回；核准後 is_verified=true 並回到 none';
comment on column public.profiles.landlord_verification_rejection_reason is '駁回原因（僅管理員寫入或透過審核流程）';

-- 非管理員僅能將 (none|rejected) -> pending，且不可改 is_verified；其餘審核欄位變更一律駁回
create or replace function public.trg_profiles_landlord_verification_guard()
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
    then
      new.landlord_verification_rejection_reason := '';
      new.landlord_verification_submitted_at := now();
    else
      new.landlord_verification_status := old.landlord_verification_status;
      new.landlord_verification_rejection_reason := old.landlord_verification_rejection_reason;
      new.landlord_verification_submitted_at := old.landlord_verification_submitted_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_landlord_verification_guard on public.profiles;
create trigger trg_profiles_landlord_verification_guard
before update on public.profiles
for each row
execute function public.trg_profiles_landlord_verification_guard();

-- 管理員可審核業主帳戶（更新 is_verified 與驗證欄位）
drop policy if exists "Admins can update profiles for verification" on public.profiles;
create policy "Admins can update profiles for verification"
on public.profiles
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());
