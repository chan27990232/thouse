-- 租客實名驗證欄位 + 觸發器（與業主共用 is_verified；需已套用 landlord_verification 與 admin_support）
-- 可重跑

alter table public.profiles
  add column if not exists tenant_verification_status text not null default 'none'
    check (tenant_verification_status in ('none', 'pending', 'rejected'));

alter table public.profiles
  add column if not exists tenant_verification_rejection_reason text not null default '';

alter table public.profiles
  add column if not exists tenant_verification_submitted_at timestamptz;

comment on column public.profiles.tenant_verification_status is
  'none=未申請, pending=待審, rejected=已駁回；核准後 is_verified=true 並回到 none';

-- 合併原業主專用觸發器：同時保護業主欄位與租客欄位
drop trigger if exists trg_profiles_landlord_verification_guard on public.profiles;
drop function if exists public.trg_profiles_landlord_verification_guard();

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

  -- 業主驗證欄位
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

  -- 租客驗證欄位
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
    then
      new.tenant_verification_rejection_reason := '';
      new.tenant_verification_submitted_at := now();
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
