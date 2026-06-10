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
