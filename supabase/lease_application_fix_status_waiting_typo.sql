-- 修復錯別字：若約束曾被誤設為 waiting_platform_1（wrong），應為 awaiting_platform_1（awa）
-- 否則與程式（leaseApplications.submit / RPC）不符，租客提交會 violates check constraint
-- Idempotent：可安全重跑

alter table public.lease_applications drop constraint if exists lease_applications_status_check;

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
  '正確拼法 awaiting_platform_*（awa），不是 waiting；流程見 lease_application_workflow.sql';
