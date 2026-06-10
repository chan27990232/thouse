-- 業主上傳水電煤單時填寫租客應付金額（港幣）
alter table public.property_utility_bills
  add column if not exists tenant_payable_hkd integer
    check (tenant_payable_hkd is null or tenant_payable_hkd >= 0);

comment on column public.property_utility_bills.tenant_payable_hkd is '該月份租客應付水電煤金額（港幣）';
