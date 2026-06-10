-- 付款期限：租金（下月 7 日）、水電煤（上傳後 21 日）；遇週末／公眾假期提前至上一個工作日

create or replace function public.is_non_working_day(p_date date)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select cd.is_weekend or cd.is_public_holiday
      from public.calendar_days cd
      where cd.calendar_date = p_date
    ),
    extract(dow from p_date)::int in (0, 6)
  );
$$;

create or replace function public.adjust_to_previous_working_day(p_date date)
returns date
language plpgsql
stable
as $$
declare
  v date := p_date;
  i int := 0;
begin
  while public.is_non_working_day(v) and i < 14 loop
    v := v - 1;
    i := i + 1;
  end loop;
  return v;
end;
$$;

comment on function public.adjust_to_previous_working_day(date) is
  '若為週六、週日或香港公眾假期，將期限提前至上一個工作日';

-- 租金：第 P 期（P>=2）帳單月 = 入住月 + (P-2) 個月；須於下月 7 日 23:59 前繳付
create or replace function public.compute_rent_payment_deadline(
  p_move_in_date date,
  p_period_index integer
)
returns date
language plpgsql
stable
as $$
declare
  v_billing_month date;
  v_raw_deadline date;
begin
  if p_move_in_date is null or p_period_index < 2 then
    return null;
  end if;

  v_billing_month := (date_trunc('month', p_move_in_date)::date + ((p_period_index - 2) || ' months')::interval)::date;
  v_raw_deadline := (date_trunc('month', v_billing_month)::date + interval '1 month' + interval '6 days')::date;
  return public.adjust_to_previous_working_day(v_raw_deadline);
end;
$$;

-- 水電煤：業主上傳後第 21 日 23:59 前繳付
create or replace function public.compute_utility_payment_deadline(p_upload_at timestamptz)
returns date
language sql
stable
as $$
  select public.adjust_to_previous_working_day((p_upload_at::date + 21));
$$;

-- 更新租金排程：due_date 改為繳付期限（非帳單月起算日）
create or replace function public.schedule_next_rent_payment(p_lease_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease record;
  v_last record;
  v_next_period integer;
  v_next_due date;
  v_amount integer;
  v_new_id uuid;
begin
  select
    la.id,
    la.tenant_id,
    la.landlord_id,
    la.property_id,
    la.move_in_date,
    la.lease_duration_months,
    coalesce(p.price, 0)::integer as monthly_rent
  into v_lease
  from public.lease_applications la
  join public.properties p on p.id = la.property_id
  where la.id = p_lease_application_id
    and la.status = 'approved';

  if v_lease.id is null then
    return null;
  end if;

  if v_lease.monthly_rent <= 0 then
    raise exception '物業月租無效，無法排程租金';
  end if;

  select rp.period_index, rp.due_date
  into v_last
  from public.rent_payments rp
  where rp.lease_application_id = p_lease_application_id
  order by rp.period_index desc
  limit 1;

  if v_last.period_index is null then
    v_next_period := 2;
  else
    v_next_period := v_last.period_index + 1;
  end if;

  if v_next_period > v_lease.lease_duration_months then
    return null;
  end if;

  v_next_due := public.compute_rent_payment_deadline(v_lease.move_in_date, v_next_period);
  if v_next_due is null then
    v_next_due := public.adjust_to_previous_working_day((current_date + interval '1 month')::date);
  end if;

  insert into public.rent_payments (
    lease_application_id,
    tenant_id,
    landlord_id,
    property_id,
    period_index,
    due_date,
    amount,
    status
  )
  values (
    v_lease.id,
    v_lease.tenant_id,
    v_lease.landlord_id,
    v_lease.property_id,
    v_next_period,
    v_next_due,
    v_lease.monthly_rent,
    'pending'
  )
  on conflict (lease_application_id, period_index) do nothing
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- 補算既有租金期限
update public.rent_payments rp
set due_date = public.compute_rent_payment_deadline(la.move_in_date, rp.period_index)
from public.lease_applications la
where la.id = rp.lease_application_id
  and la.move_in_date is not null
  and rp.period_index >= 2;
