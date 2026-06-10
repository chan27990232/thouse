-- 管理員（app_admins）平台一審／複審
-- is_app_admin() 來自 admin_support.sql；須先有 lease_application_workflow 之 status 約束
--
-- PostgREST 依參數「名稱字母順序」對應型別：p_application_id, p_approve, p_stage
-- → (uuid, boolean, integer)。若簽章為 (uuid, integer, boolean) 會回報找不到函式。

drop function if exists public.platform_review_lease_application(uuid, integer, boolean);

create or replace function public.platform_review_lease_application(
  p_application_id uuid,
  p_approve boolean,
  p_stage integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_property uuid;
  v_landlord uuid;
begin
  if not public.is_app_admin() then
    raise exception '需要管理員權限';
  end if;

  if p_stage is distinct from 1 and p_stage is distinct from 2 then
    raise exception '階段必須為 1（一審）或 2（複審）';
  end if;

  select la.id, la.status, la.property_id, la.landlord_id
    into rec
    from public.lease_applications la
    where la.id = p_application_id;

  if rec.id is null then
    raise exception '找不到申請';
  end if;

  v_property := rec.property_id;
  v_landlord := rec.landlord_id;

  if p_stage = 1 then
    if rec.status is distinct from 'awaiting_platform_1' then
      raise exception '此申請不在「待平台一審」狀態（目前為 %）', rec.status;
    end if;
    if p_approve then
      update public.lease_applications
        set status = 'awaiting_landlord'
      where id = p_application_id
        and status = 'awaiting_platform_1';
    else
      update public.lease_applications
        set status = 'rejected'
      where id = p_application_id
        and status = 'awaiting_platform_1';
    end if;
    if not found then
      raise exception '更新失敗，請重新整理後再試';
    end if;
    return;
  end if;

  -- p_stage = 2
  if rec.status is distinct from 'awaiting_platform_2' then
    raise exception '此申請不在「待平台複審」狀態（目前為 %）', rec.status;
  end if;

  if p_approve then
    update public.lease_applications
      set status = 'approved'
    where id = p_application_id
      and status = 'awaiting_platform_2';

    if not found then
      raise exception '更新失敗，請重新整理後再試';
    end if;

    update public.lease_applications
      set status = 'rejected'
    where property_id = v_property
      and id <> p_application_id
      and status in ('awaiting_platform_1', 'awaiting_landlord', 'awaiting_platform_2');

    update public.properties
      set status = 'rented',
          updated_at = now()
    where id = v_property
      and landlord_id = v_landlord;
  else
    update public.lease_applications
      set status = 'rejected'
    where id = p_application_id
      and status = 'awaiting_platform_2';
    if not found then
      raise exception '更新失敗，請重新整理後再試';
    end if;
  end if;
end;
$$;

comment on function public.platform_review_lease_application(uuid, boolean, integer) is
  '管理員一審 awaiting_platform_1→awaiting_landlord/rejected；複審 awaiting_platform_2→approved（並租盤 rented）／rejected。';

grant execute on function public.platform_review_lease_application(uuid, boolean, integer) to authenticated;
