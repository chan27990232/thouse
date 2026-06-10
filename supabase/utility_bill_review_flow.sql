-- 業主上傳 → 管理後台審核 → 租客方可繳付

-- 業主每次上傳（含同月追加檔案）皆重置為待審核
create or replace function public.prepare_utility_bill_for_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.review_status := 'pending_review';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.review_notes := null;

  update public.property_utility_bills
  set
    review_status = 'pending_review',
    reviewed_at = null,
    reviewed_by = null,
    review_notes = null,
    updated_at = now()
  where property_id = new.property_id
    and bill_month = new.bill_month
    and id is distinct from new.id;

  return new;
end;
$$;

drop trigger if exists trg_prepare_utility_bill_for_review on public.property_utility_bills;
create trigger trg_prepare_utility_bill_for_review
before insert on public.property_utility_bills
for each row
execute function public.prepare_utility_bill_for_review();

-- 未填應付金額的舊紀錄改回待審核
update public.property_utility_bills
set
  review_status = 'pending_review',
  reviewed_at = null,
  reviewed_by = null,
  review_notes = null
where review_status = 'approved'
  and coalesce(tenant_payable_hkd, 0) <= 0;

-- 移除未核准月份之租客應付
delete from public.tenant_utility_obligations tuo
where not exists (
  select 1
  from public.property_utility_bills b
  where b.property_id = tuo.property_id
    and b.bill_month = tuo.bill_month
    and b.review_status = 'approved'
);

-- 提交水電煤付款須帳單已核准
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

  select exists (
    select 1
    from public.property_utility_bills b
    where b.property_id = v_row.property_id
      and b.bill_month = v_row.bill_month
      and b.review_status = 'approved'
  )
  into v_approved;

  if not v_approved then
    raise exception '此月份水電煤帳單尚未通過平台審核，請待審核完成後再繳付';
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
    'status', 'paid'
  );
end;
$$;

grant execute on function public.submit_utility_payment(uuid, text, text) to authenticated;
