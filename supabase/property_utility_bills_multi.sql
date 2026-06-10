-- 業主水電煤單：同一物業、同一月份可上傳最多 10 個檔案
alter table public.property_utility_bills
  drop constraint if exists property_utility_bills_property_month_unique;

create index if not exists property_utility_bills_property_month_idx
  on public.property_utility_bills (property_id, bill_month, created_at desc);

comment on table public.property_utility_bills is '業主按物業、按月上傳水電煤單（每月最多 10 檔）；檔案 path 在 property-verification bucket';
