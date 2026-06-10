-- 業主管理進行中租約：提早結束、續約、違約
-- 須已執行 lease_application_workflow.sql、rent_payments.sql

alter table public.lease_applications drop constraint if exists lease_applications_status_check;

alter table public.lease_applications
  add column if not exists ended_at timestamptz,
  add column if not exists landlord_management_notes text not null default '',
  add column if not exists last_renewed_at timestamptz;

alter table public.lease_applications add constraint lease_applications_status_check
  check (status in (
    'awaiting_platform_1',
    'awaiting_landlord',
    'awaiting_platform_2',
    'approved',
    'rejected',
    'ended_early',
    'ended_breach'
  ));

comment on column public.lease_applications.ended_at is '租約實際結束時間（提早結束／違約）';
comment on column public.lease_applications.landlord_management_notes is '業主租約管理備註（續約／結束／違約）';
comment on column public.lease_applications.last_renewed_at is '最近一次續約時間';

alter table public.rent_payments drop constraint if exists rent_payments_status_check;
alter table public.rent_payments add constraint rent_payments_status_check
  check (status in ('pending', 'pending_bank', 'paid', 'overdue', 'cancelled'));

drop function if exists public.landlord_manage_lease(uuid, text, text, integer, date);

create or replace function public.landlord_manage_lease(
  p_lease_application_id uuid,
  p_action text,
  p_notes text default '',
  p_renewal_months integer default null,
  p_early_end_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease record;
  v_note_line text;
  v_end_date date;
begin
  if p_action is distinct from 'early_end'
     and p_action is distinct from 'renew'
     and p_action is distinct from 'breach' then
    raise exception '動作無效（須為 early_end / renew / breach）';
  end if;

  select la.id, la.landlord_id, la.property_id, la.status, la.lease_duration_months
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

  v_note_line := coalesce(nullif(trim(p_notes), ''), '—');

  if p_action = 'renew' then
    if p_renewal_months is null or p_renewal_months < 1 or p_renewal_months > 60 then
      raise exception '續約月數須為 1–60';
    end if;

    update public.lease_applications
    set
      lease_duration_months = lease_duration_months + p_renewal_months,
      last_renewed_at = now(),
      landlord_management_notes = trim(
        coalesce(landlord_management_notes, '')
        || E'\n[' || to_char(now() at time zone 'Asia/Hong_Kong', 'YYYY-MM-DD HH24:MI') || '] 續約 +'
        || p_renewal_months::text || ' 個月：' || v_note_line
      )
    where id = p_lease_application_id
      and status = 'approved';

    if not found then
      raise exception '續約失敗，請重新整理後再試';
    end if;
    return;
  end if;

  v_end_date := coalesce(p_early_end_date, current_date);

  update public.lease_applications
  set
    status = case when p_action = 'breach' then 'ended_breach' else 'ended_early' end,
    ended_at = v_end_date::timestamptz,
    landlord_management_notes = trim(
      coalesce(landlord_management_notes, '')
      || E'\n[' || to_char(now() at time zone 'Asia/Hong_Kong', 'YYYY-MM-DD HH24:MI') || '] '
      || case when p_action = 'breach' then '違約結束' else '提早結束' end
      || '（' || v_end_date::text || '）：' || v_note_line
    )
  where id = p_lease_application_id
    and status = 'approved';

  if not found then
    raise exception '結束租約失敗，請重新整理後再試';
  end if;

  update public.properties
  set status = 'available', updated_at = now()
  where id = v_lease.property_id
    and landlord_id = v_lease.landlord_id;

  update public.rent_payments
  set status = 'cancelled'
  where lease_application_id = p_lease_application_id
    and status in ('pending', 'pending_bank', 'overdue');

  delete from public.tenant_utility_obligations
  where lease_application_id = p_lease_application_id
    and status in ('pending', 'pending_bank', 'overdue');
end;
$$;

comment on function public.landlord_manage_lease(uuid, text, text, integer, date) is
  '業主：early_end／breach 結束租約並釋放物業；renew 延長 lease_duration_months';

grant execute on function public.landlord_manage_lease(uuid, text, text, integer, date) to authenticated;
