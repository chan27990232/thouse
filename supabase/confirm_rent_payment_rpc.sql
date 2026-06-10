-- 管理員確認入數後標記已付，並自動排下一期租金

create or replace function public.confirm_rent_payment(p_rent_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease_id uuid;
begin
  if not public.is_app_admin() then
    raise exception '需要管理員權限';
  end if;

  update public.rent_payments
  set
    status = 'paid',
    paid_at = now()
  where id = p_rent_payment_id
    and status = 'pending_bank'
  returning lease_application_id into v_lease_id;

  if v_lease_id is null then
    raise exception '找不到待確認的租金紀錄';
  end if;

  perform public.schedule_next_rent_payment(v_lease_id);
end;
$$;

grant execute on function public.confirm_rent_payment(uuid) to authenticated;

comment on function public.confirm_rent_payment(uuid) is
  '管理員核對入數後標記 paid，並排程下一期租金';
