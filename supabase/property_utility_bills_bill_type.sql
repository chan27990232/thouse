-- 業主上傳水電煤單：標記帳單類型（水費／電費／煤氣費）

alter table public.property_utility_bills
  add column if not exists bill_type text
    check (bill_type is null or bill_type in ('water', 'electricity', 'gas'));

comment on column public.property_utility_bills.bill_type is '帳單類型：water=水費, electricity=電費, gas=煤氣費';

-- 租客應付金額：已核准月份內各類型取最高應付後加總
create or replace function public.sum_approved_utility_payable(
  p_property_id uuid,
  p_bill_month date
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(sub.amount), 0)
  from (
    select max(b.tenant_payable_hkd) as amount
    from public.property_utility_bills b
    where b.property_id = p_property_id
      and b.bill_month = p_bill_month
      and b.review_status = 'approved'
      and coalesce(b.tenant_payable_hkd, 0) > 0
    group by coalesce(b.bill_type, 'legacy')
  ) sub;
$$;

-- sync_utility_obligation_for_month 定義見 tenant_utility_obligations_bill_type.sql
