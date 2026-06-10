-- 業主在「平台一審通過後」同意／婉拒租客（SECURITY DEFINER）
-- pending 請先執行 lease_application_workflow.sql 將狀態遷移至新約束。
-- 同意 → awaiting_platform_2（再等平台複審）；複審通過見 platform_review_lease_application_rpc.sql
--
-- 若錯誤為「could not find ... respond_to_lease_application ... in the schema cache」：
--   多半是此檔尚未在該 Supabase 專案執行，或 PostgREST 快取過期 —
--   請在 Dashboard → SQL 貼上本檔執行，再到 Settings → API → Reload schema。

create or replace function public.respond_to_lease_application(p_application_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landlord uuid;
  v_property_id uuid;
begin
  if p_decision is distinct from 'approved' and p_decision is distinct from 'rejected' then
    raise exception '決定無效（必須為 approved / rejected）';
  end if;

  select la.landlord_id, la.property_id
    into v_landlord, v_property_id
    from public.lease_applications la
    where la.id = p_application_id
      and la.status = 'awaiting_landlord';

  if v_landlord is null then
    raise exception '找不到待業主確認的申請（須已由平台放行）';
  end if;

  if v_landlord is distinct from (select auth.uid()) then
    raise exception '無權處理此申請';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'landlord'
  ) then
    raise exception '需要以業主身份登入';
  end if;

  if p_decision = 'approved' then
    update public.lease_applications
      set status = 'awaiting_platform_2'
    where id = p_application_id
      and status = 'awaiting_landlord';

    if not found then
      raise exception '更新失敗，請重新整理後再試';
    end if;

    update public.lease_applications
      set status = 'rejected'
    where property_id = v_property_id
      and id <> p_application_id
      and status = 'awaiting_landlord';

  else
    update public.lease_applications
      set status = 'rejected'
    where id = p_application_id
      and status = 'awaiting_landlord';

    if not found then
      raise exception '更新失敗，請重新整理後再試';
    end if;
  end if;
end;
$$;

comment on function public.respond_to_lease_application(uuid, text) is
  '業主於 awaiting_landlord：同意→awaiting_platform_2 並自動拒絕同盤其餘 awaiting_landlord；婉拒→rejected';

grant execute on function public.respond_to_lease_application(uuid, text) to authenticated;
