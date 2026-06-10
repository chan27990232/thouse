-- 租客水電煤應付：按帳單類型（水費／電費／煤氣費）分開繳付

alter table public.tenant_utility_obligations
  add column if not exists bill_type text
    check (bill_type is null or bill_type in ('water', 'electricity', 'gas', 'legacy'));

update public.tenant_utility_obligations
set bill_type = 'legacy'
where bill_type is null;

alter table public.tenant_utility_obligations
  drop constraint if exists tenant_utility_obligations_unique_month;

drop index if exists tenant_utility_obligations_property_month_type_uidx;
create unique index tenant_utility_obligations_property_month_type_uidx
  on public.tenant_utility_obligations (property_id, bill_month, bill_type);

comment on column public.tenant_utility_obligations.bill_type is '應付類型：water=水費, electricity=電費, gas=煤氣費';

-- 同步單一月份：每種已核准帳單類型各一筆應付
create or replace function public.sync_utility_obligation_for_month(
  p_property_id uuid,
  p_bill_month date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_lease_id uuid;
  v_upload_at timestamptz;
  v_due date;
  v_approved boolean;
  r record;
begin
  select exists (
    select 1
    from public.property_utility_bills b
    where b.property_id = p_property_id
      and b.bill_month = p_bill_month
      and b.review_status = 'approved'
  )
  into v_approved;

  if not v_approved then
    delete from public.tenant_utility_obligations
    where property_id = p_property_id
      and bill_month = p_bill_month
      and status in ('pending', 'overdue');
    return;
  end if;

  select la.tenant_id, la.id
  into v_tenant_id, v_lease_id
  from public.lease_applications la
  where la.property_id = p_property_id
    and la.status = 'approved'
  order by la.created_at desc
  limit 1;

  if v_tenant_id is null then
    return;
  end if;

  select max(greatest(b.updated_at, b.created_at))
  into v_upload_at
  from public.property_utility_bills b
  where b.property_id = p_property_id
    and b.bill_month = p_bill_month
    and b.review_status = 'approved';

  v_due := public.compute_utility_payment_deadline(v_upload_at);

  delete from public.tenant_utility_obligations tuo
  where tuo.property_id = p_property_id
    and tuo.bill_month = p_bill_month
    and tuo.status in ('pending', 'overdue')
    and tuo.bill_type is not null
    and tuo.bill_type <> 'legacy'
    and not exists (
      select 1
      from public.property_utility_bills b
      where b.property_id = tuo.property_id
        and b.bill_month = tuo.bill_month
        and b.bill_type = tuo.bill_type
        and b.review_status = 'approved'
        and coalesce(b.tenant_payable_hkd, 0) > 0
    );

  for r in
    select
      b.bill_type as bill_type,
      max(b.tenant_payable_hkd) as amount
    from public.property_utility_bills b
    where b.property_id = p_property_id
      and b.bill_month = p_bill_month
      and b.review_status = 'approved'
      and b.bill_type in ('water', 'electricity', 'gas')
      and coalesce(b.tenant_payable_hkd, 0) > 0
    group by b.bill_type
  loop
    insert into public.tenant_utility_obligations (
      property_id,
      tenant_id,
      lease_application_id,
      bill_month,
      bill_type,
      amount,
      upload_at,
      due_date,
      status,
      updated_at
    )
    values (
      p_property_id,
      v_tenant_id,
      v_lease_id,
      p_bill_month,
      r.bill_type,
      r.amount,
      v_upload_at,
      v_due,
      'pending',
      now()
    )
    on conflict (property_id, bill_month, bill_type) do update
    set
      amount = excluded.amount,
      upload_at = excluded.upload_at,
      due_date = excluded.due_date,
      lease_application_id = excluded.lease_application_id,
      tenant_id = excluded.tenant_id,
      updated_at = now()
    where tenant_utility_obligations.status in ('pending', 'overdue');
  end loop;
end;
$$;

create or replace function public.submit_utility_payment(
  p_obligation_id uuid,
  p_method text,
  p_receipt_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tenant_utility_obligations%rowtype;
  v_ref text;
  v_approved boolean;
begin
  if p_method is distinct from 'fps' and p_method is distinct from 'bank_transfer' then
    raise exception '付款方式無效';
  end if;

  if coalesce(trim(p_receipt_url), '') = '' then
    raise exception '請上傳轉賬證明';
  end if;

  select * into v_row
  from public.tenant_utility_obligations
  where id = p_obligation_id
    and tenant_id = (select auth.uid())
  for update;

  if v_row.id is null then
    raise exception '找不到待繳水電煤紀錄';
  end if;

  if v_row.bill_type = 'legacy' then
    select exists (
      select 1
      from public.property_utility_bills b
      where b.property_id = v_row.property_id
        and b.bill_month = v_row.bill_month
        and b.review_status = 'approved'
    )
    into v_approved;
  else
    select exists (
      select 1
      from public.property_utility_bills b
      where b.property_id = v_row.property_id
        and b.bill_month = v_row.bill_month
        and b.bill_type = v_row.bill_type
        and b.review_status = 'approved'
    )
    into v_approved;
  end if;

  if not v_approved then
    raise exception '此帳單尚未通過平台審核，請待審核完成後再繳付';
  end if;

  if v_row.status not in ('pending', 'overdue') then
    raise exception '此筆水電煤狀態不可提交（目前為 %）', v_row.status;
  end if;

  v_ref := gen_random_uuid()::text;

  update public.tenant_utility_obligations
  set
    status = 'paid',
    payment_method = p_method,
    payment_reference = v_ref,
    bank_transfer_receipt_url = trim(p_receipt_url),
    paid_at = now(),
    updated_at = now()
  where id = p_obligation_id;

  return jsonb_build_object(
    'payment_reference', v_ref,
    'amount', v_row.amount,
    'due_date', v_row.due_date,
    'bill_type', v_row.bill_type,
    'status', 'paid'
  );
end;
$$;

grant execute on function public.submit_utility_payment(uuid, text, text) to authenticated;

-- 移除舊的合併應付（待繳／逾期），改按類型重建
delete from public.tenant_utility_obligations
where status in ('pending', 'overdue')
  and (bill_type is null or bill_type = 'legacy');

do $$
declare
  r record;
begin
  for r in
    select distinct property_id, bill_month
    from public.property_utility_bills
    where review_status = 'approved'
  loop
    perform public.sync_utility_obligation_for_month(r.property_id, r.bill_month);
  end loop;
end;
$$;
