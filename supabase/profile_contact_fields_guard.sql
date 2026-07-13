-- 一般使用者不可在個人資料頁自行修改電話與 Email（管理員仍可透過後台調整）

create or replace function public.trg_profiles_contact_fields_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_app_admin() then
    return new;
  end if;

  if new.phone is distinct from old.phone then
    new.phone := old.phone;
  end if;

  if new.email is distinct from old.email then
    new.email := old.email;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_contact_fields_guard on public.profiles;
create trigger trg_profiles_contact_fields_guard
  before update on public.profiles
  for each row
  execute function public.trg_profiles_contact_fields_guard();
