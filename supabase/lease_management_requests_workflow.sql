-- 業主租約變更：提交申請 → 管理員審核後才更新租約
-- 須已執行 landlord_manage_lease_rpc.sql

create table if not exists public.lease_management_requests (
  id uuid primary key default gen_random_uuid(),
  lease_application_id uuid not null references public.lease_applications (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  request_type text not null check (request_type in ('early_end', 'renew', 'breach')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  notes text not null default '',
  renewal_months integer,
  early_end_date date,
  admin_notes text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lease_mgmt_renewal_months_chk check (
    request_type <> 'renew' or (renewal_months is not null and renewal_months >= 1 and renewal_months <= 60)
  ),
  constraint lease_mgmt_early_end_date_chk check (
    request_type <> 'early_end' or early_end_date is not null
  )
);

create unique index if not exists lease_management_requests_one_pending_per_lease_uidx
  on public.lease_management_requests (lease_application_id)
  where status = 'pending';

create index if not exists lease_management_requests_status_created_idx
  on public.lease_management_requests (status, created_at desc);

comment on table public.lease_management_requests is '業主提早結束／續約／違約申請，須經管理員審核';

alter table public.lease_management_requests enable row level security;

drop policy if exists "Landlords read own lease management requests" on public.lease_management_requests;
create policy "Landlords read own lease management requests"
on public.lease_management_requests for select to authenticated
using (landlord_id = (select auth.uid()));

drop policy if exists "Admins read all lease management requests" on public.lease_management_requests;
create policy "Admins read all lease management requests"
on public.lease_management_requests for select to authenticated
using (public.is_app_admin());

grant select on public.lease_management_requests to authenticated;

-- 審核通過後執行實際租約變更
create or replace function public._apply_approved_lease_management_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_note_line text;
  v_end_date date;
begin
  select r.*, la.status as lease_status
  into v_req
  from public.lease_management_requests r
  join public.lease_applications la on la.id = r.lease_application_id
  where r.id = p_request_id
    and r.status = 'pending';

  if v_req.id is null then
    raise exception '找不到待審核申請';
  end if;

  if v_req.lease_status <> 'approved' then
    raise exception '租約已不是進行中狀態，無法套用變更';
  end if;

  v_note_line := coalesce(nullif(trim(v_req.notes), ''), '—');

  if v_req.request_type = 'renew' then
    update public.lease_applications
    set
      lease_duration_months = lease_duration_months + v_req.renewal_months,
      last_renewed_at = now(),
      landlord_management_notes = trim(
        coalesce(landlord_management_notes, '')
        || E'\n[' || to_char(now() at time zone 'Asia/Hong_Kong', 'YYYY-MM-DD HH24:MI') || '] 續約 +'
        || v_req.renewal_months::text || ' 個月（平台已核准）：' || v_note_line
      )
    where id = v_req.lease_application_id
      and status = 'approved';
    return;
  end if;

  v_end_date := coalesce(v_req.early_end_date, current_date);

  update public.lease_applications
  set
    status = case when v_req.request_type = 'breach' then 'ended_breach' else 'ended_early' end,
    ended_at = v_end_date::timestamptz,
    landlord_management_notes = trim(
      coalesce(landlord_management_notes, '')
      || E'\n[' || to_char(now() at time zone 'Asia/Hong_Kong', 'YYYY-MM-DD HH24:MI') || '] '
      || case when v_req.request_type = 'breach' then '違約結束' else '提早結束' end
      || '（' || v_end_date::text || '，平台已核准）：' || v_note_line
    )
  where id = v_req.lease_application_id
    and status = 'approved';

  if not found then
    raise exception '結束租約失敗';
  end if;

  update public.properties
  set status = 'available', updated_at = now()
  where id = v_req.property_id
    and landlord_id = v_req.landlord_id;

  update public.rent_payments
  set status = 'cancelled'
  where lease_application_id = v_req.lease_application_id
    and status in ('pending', 'pending_bank', 'overdue');

  delete from public.tenant_utility_obligations
  where lease_application_id = v_req.lease_application_id
    and status in ('pending', 'pending_bank', 'overdue');
end;
$$;

-- 業主：僅提交申請（回傳 uuid；若先前為 void 須先 drop）
drop function if exists public.landlord_manage_lease(uuid, text, text, integer, date);

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
      and r.status = 'pending'
  ) then
    raise exception '已有待平台審核的租約變更申請，請等候處理後再提交';
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

  insert into public.lease_management_requests (
    lease_application_id,
    property_id,
    landlord_id,
    request_type,
    notes,
    renewal_months,
    early_end_date
  )
  values (
    p_lease_application_id,
    v_lease.property_id,
    v_lease.landlord_id,
    p_action,
    coalesce(trim(p_notes), ''),
    case when p_action = 'renew' then p_renewal_months else null end,
    case when p_action = 'early_end' then v_end_date else null end
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.landlord_manage_lease(uuid, text, text, integer, date) is
  '業主提交租約變更申請（提早結束／續約／違約），待管理員審核';

create or replace function public.admin_review_lease_management_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception '需要管理員權限';
  end if;

  if p_approve then
    perform public._apply_approved_lease_management_request(p_request_id);

    update public.lease_management_requests
    set
      status = 'approved',
      admin_notes = coalesce(trim(p_admin_notes), ''),
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
    where id = p_request_id
      and status = 'pending';

    if not found then
      raise exception '審核失敗，請重新整理後再試';
    end if;
  else
    update public.lease_management_requests
    set
      status = 'rejected',
      admin_notes = coalesce(trim(p_admin_notes), ''),
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
    where id = p_request_id
      and status = 'pending';

    if not found then
      raise exception '審核失敗，請重新整理後再試';
    end if;
  end if;
end;
$$;

comment on function public.admin_review_lease_management_request(uuid, boolean, text) is
  '管理員審核業主租約變更申請；核准後才更新租約狀態';

grant execute on function public.admin_review_lease_management_request(uuid, boolean, text) to authenticated;
