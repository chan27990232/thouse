-- 租客提交每月租金（轉數快／銀行轉賬 + 收據）
-- 提交後標記為 paid 並排下一期；管理員可用 confirm_rent_payment 處理 pending_bank（若日後改回待核對流程）

create or replace function public.submit_rent_payment(
  p_rent_payment_id uuid,
  p_method text,
  p_receipt_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rent_payments%rowtype;
  v_ref text;
  v_next_id uuid;
begin
  if p_method is distinct from 'fps' and p_method is distinct from 'bank_transfer' then
    raise exception '付款方式無效';
  end if;

  if coalesce(trim(p_receipt_url), '') = '' then
    raise exception '請上傳轉賬證明';
  end if;

  select * into v_row
  from public.rent_payments
  where id = p_rent_payment_id
    and tenant_id = (select auth.uid())
  for update;

  if v_row.id is null then
    raise exception '找不到待繳租金紀錄';
  end if;

  if v_row.status not in ('pending', 'overdue') then
    raise exception '此期租金狀態不可提交（目前為 %）', v_row.status;
  end if;

  v_ref := gen_random_uuid()::text;

  update public.rent_payments
  set
    status = 'paid',
    payment_method = p_method,
    payment_reference = v_ref,
    bank_transfer_receipt_url = trim(p_receipt_url),
    paid_at = now()
  where id = p_rent_payment_id;

  v_next_id := public.schedule_next_rent_payment(v_row.lease_application_id);

  return jsonb_build_object(
    'payment_reference', v_ref,
    'amount', v_row.amount,
    'due_date', v_row.due_date,
    'period_index', v_row.period_index,
    'status', 'paid',
    'next_payment_id', v_next_id
  );
end;
$$;

grant execute on function public.submit_rent_payment(uuid, text, text) to authenticated;

comment on function public.submit_rent_payment(uuid, text, text) is
  '租客上傳收據並完成每月租金繳付，自動排程下一期';
