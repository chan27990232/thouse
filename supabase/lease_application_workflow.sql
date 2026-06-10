-- 租約申請四段流程（與程式碼一致）：
-- 租客提交 awaiting_platform_1 → 平台一審 awaiting_landlord → 業主同意 awaiting_platform_2 → 平台複審 approved／rejected
-- 請在套用 respond_to / platform_review RPC 前先執行本檔以遷移既有資料列。
--
-- ⚠️ status 字面量請務必用 awaiting（a-w-a-i-t-i-n-g），不可用 waiting。
--    若誤建了 waiting_platform_1，請執行 lease_application_fix_status_waiting_typo.sql。

alter table public.lease_applications drop constraint if exists lease_applications_status_check;

-- 舊資料：pending（原業主可見「待處理」）→ 視為已通過一審、待業主；approved／rejected 保持
update public.lease_applications
set status = 'awaiting_landlord'
where status = 'pending';

-- 錯別字 waiting → awaiting（見 lease_application_fix_status_waiting_typo.sql）
update public.lease_applications
set status = 'awaiting_platform_1'
where status = 'waiting_platform_1';

alter table public.lease_applications alter column status set default 'awaiting_platform_1';

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

comment on column public.lease_applications.status is
  'awaiting_platform_1=待平台一審（業主選單看不到）; awaiting_landlord=待業主; awaiting_platform_2=待平台複審; approved/rejected';

-- 業主僅可查「已完成平台一審」之後的紀錄
drop policy if exists "Landlords can read applications for their properties" on public.lease_applications;
create policy "Landlords can read applications for their properties"
on public.lease_applications
for select
to authenticated
using (
  landlord_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'landlord'
  )
  and status is distinct from 'awaiting_platform_1'
);
