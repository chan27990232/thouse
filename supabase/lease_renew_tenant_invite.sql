-- 續約改為業主邀請 → 租客確認 → 平台審核（須已執行 lease_management_requests_workflow.sql）

alter table public.lease_management_requests
  drop constraint if exists lease_management_requests_status_check;

alter table public.lease_management_requests
  add constraint lease_management_requests_status_check
  check (status in ('awaiting_tenant', 'pending', 'approved', 'rejected'));

drop index if exists lease_management_requests_one_pending_per_lease_uidx;

create unique index if not exists lease_management_requests_one_open_per_lease_uidx
  on public.lease_management_requests (lease_application_id)
  where status in ('pending', 'awaiting_tenant');

-- 業主提交：續約為 awaiting_tenant，其餘仍為 pending
create or replace function public.landlord_manage_lease(
  p_lease_application_id uuid,
  p_action text,
  p_notes text default '',
  p_renewal_months integer default null,
  p_early_end_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease record;
  v_request_id uuid;
  v_end_date date;
  v_status text;
begin
  if p_action is distinct from 'early_end'
     and p_action is distinct from 'renew'
     and p_action is distinct from 'breach' then
    raise exception '動作無效（須為 early_end / renew / breach）';
  end if;

  select la.id, la.landlord_id, la.property_id, la.status
  into v_lease
  from public.lease_applications la
  where la.id = p_lease_application_id;

  if v_lease.id is null then
    raise exception '找不到租約';
  end if;

  if v_lease.landlord_id is distinct from (select auth.uid()) then
    raise exception '無權處理此租約';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'landlord'
  ) then
    raise exception '需要以業主身份登入';
  end if;

  if v_lease.status <> 'approved' then
    raise exception '僅可管理進行中的核准租約';
  end if;

  if exists (
    select 1 from public.lease_management_requests r
    where r.lease_application_id = p_lease_application_id
      and r.status in ('pending', 'awaiting_tenant')
  ) then
    raise exception '已有進行中的租約變更申請，請等候處理後再提交';
  end if;

  if p_action = 'renew' then
    if p_renewal_months is null or p_renewal_months < 1 or p_renewal_months > 60 then
      raise exception '續約月數須為 1–60';
    end if;
  end if;

  if p_action = 'breach' and nullif(trim(p_notes), '') is null then
    raise exception '違約申請須填寫說明';
  end if;

  v_end_date := coalesce(p_early_end_date, current_date);
  v_status := case when p_action = 'renew' then 'awaiting_tenant' else 'pending' end;

  insert into public.lease_management_requests (
    lease_application_id,
    property_id,
    landlord_id,
    request_type,
    status,
    notes,
    renewal_months,
    early_end_date
  )
  values (
    p_lease_application_id,
    v_lease.property_id,
    v_lease.landlord_id,
    p_action,
    v_status,
    coalesce(trim(p_notes), ''),
    case when p_action = 'renew' then p_renewal_months else null end,
    case when p_action = 'early_end' then v_end_date else null end
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.landlord_manage_lease(uuid, text, text, integer, date) is
  '業主提交租約變更；續約先等候租客確認，其餘待管理員審核';

-- 租客回應續約邀請
create or replace function public.tenant_respond_lease_renewal(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
begin
  if not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'tenant'
  ) then
    raise exception '需要以租客身份登入';
  end if;

  select r.id, r.request_type, r.status, la.tenant_id
  into v_req
  from public.lease_management_requests r
  join public.lease_applications la on la.id = r.lease_application_id
  where r.id = p_request_id;

  if v_req.id is null then
    raise exception '找不到申請';
  end if;

  if v_req.tenant_id is distinct from (select auth.uid()) then
    raise exception '無權處理此申請';
  end if;

  if v_req.request_type <> 'renew' then
    raise exception '此申請不是續約邀請';
  end if;

  if v_req.status <> 'awaiting_tenant' then
    raise exception '此邀請已處理或已失效';
  end if;

  if p_accept then
    update public.lease_management_requests
    set status = 'pending'
    where id = p_request_id
      and status = 'awaiting_tenant';

    if not found then
      raise exception '確認失敗，請重新整理後再試';
    end if;
  else
    update public.lease_management_requests
    set
      status = 'rejected',
      admin_notes = '租客拒絕續約邀請',
      reviewed_at = now()
    where id = p_request_id
      and status = 'awaiting_tenant';

    if not found then
      raise exception '拒絕失敗，請重新整理後再試';
    end if;
  end if;
end;
$$;

comment on function public.tenant_respond_lease_renewal(uuid, boolean) is
  '租客接受或拒絕業主續約邀請；接受後進入平台審核';

grant execute on function public.tenant_respond_lease_renewal(uuid, boolean) to authenticated;

-- 租客可讀取自己租約的變更申請
drop policy if exists "Tenants read lease management for own leases" on public.lease_management_requests;
create policy "Tenants read lease management for own leases"
on public.lease_management_requests for select to authenticated
using (
  exists (
    select 1
    from public.lease_applications la
    where la.id = lease_application_id
      and la.tenant_id = (select auth.uid())
  )
);
