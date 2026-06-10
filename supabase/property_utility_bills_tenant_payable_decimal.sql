-- 租客應付水電支援小數（港幣，最多兩位）
alter table public.property_utility_bills
  drop constraint if exists property_utility_bills_tenant_payable_hkd_check;

alter table public.property_utility_bills
  alter column tenant_payable_hkd type numeric(10, 2)
  using tenant_payable_hkd::numeric(10, 2);

alter table public.property_utility_bills
  add constraint property_utility_bills_tenant_payable_hkd_check
    check (tenant_payable_hkd is null or tenant_payable_hkd >= 0);

comment on column public.property_utility_bills.tenant_payable_hkd is '該月份租客應付水電煤金額（港幣，可含小數）';
