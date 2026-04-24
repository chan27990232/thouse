-- 在已有 lease_applications 表上增加付款中繼資料（執行一次即可）
-- 與 supabase/lease_applications.sql 併用；舊列可為 null

alter table public.lease_applications
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('card', 'fps', 'bank_transfer'));

alter table public.lease_applications
  add column if not exists payment_status text
    check (payment_status is null or payment_status in ('succeeded', 'pending_bank', 'failed'));

alter table public.lease_applications
  add column if not exists payment_reference text;

alter table public.lease_applications
  add column if not exists card_last4 text;

alter table public.lease_applications
  add column if not exists paid_at timestamp with time zone;

create unique index if not exists lease_applications_payment_reference_uidx
  on public.lease_applications (payment_reference)
  where payment_reference is not null;

comment on column public.lease_applications.payment_method is 'card | fps | bank_transfer';
comment on column public.lease_applications.payment_status is 'succeeded: 已記帳; pending_bank: 待入數核對';
comment on column public.lease_applications.payment_reference is '收據／對賬參考編號';
comment on column public.lease_applications.card_last4 is '僅末四碼';
