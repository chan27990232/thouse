-- 租客水電煤應付（業主上傳帳單後產生）

create table if not exists public.tenant_utility_obligations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  lease_application_id uuid references public.lease_applications (id) on delete set null,
  bill_month date not null,
  amount numeric(10, 2) not null check (amount >= 0),
  upload_at timestamptz not null,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'pending_bank', 'paid', 'overdue')),
  payment_method text check (payment_method is null or payment_method in ('fps', 'bank_transfer')),
  payment_reference text,
  bank_transfer_receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_utility_obligations_unique_month unique (property_id, bill_month),
  constraint tenant_utility_obligations_bill_month_first_day check (extract(day from bill_month) = 1)
);

create index if not exists tenant_utility_obligations_tenant_idx
  on public.tenant_utility_obligations (tenant_id, due_date);

alter table public.tenant_utility_obligations enable row level security;

drop policy if exists "Tenants read own utility obligations" on public.tenant_utility_obligations;
create policy "Tenants read own utility obligations"
on public.tenant_utility_obligations for select to authenticated
using (tenant_id = (select auth.uid()));

drop policy if exists "Landlords read utility obligations for their properties" on public.tenant_utility_obligations;
create policy "Landlords read utility obligations for their properties"
on public.tenant_utility_obligations for select to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_id and p.landlord_id = (select auth.uid())
  )
);

drop policy if exists "Admins read all utility obligations" on public.tenant_utility_obligations;
create policy "Admins read all utility obligations"
on public.tenant_utility_obligations for select to authenticated
using (public.is_app_admin());

-- 業主上傳水電煤單時同步／更新租客應付紀錄
create or replace function public.sync_tenant_utility_obligation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_lease_id uuid;
  v_amount numeric(10, 2);
  v_upload_at timestamptz;
  v_due date;
begin
  select la.tenant_id, la.id
  into v_tenant_id, v_lease_id
  from public.lease_applications la
  where la.property_id = new.property_id
    and la.status = 'approved'
  order by la.created_at desc
  limit 1;

  if v_tenant_id is null then
    return new;
  end if;

  select coalesce(max(b.tenant_payable_hkd), 0), max(greatest(b.updated_at, b.created_at))
  into v_amount, v_upload_at
  from public.property_utility_bills b
  where b.property_id = new.property_id
    and b.bill_month = new.bill_month;

  if v_amount is null or v_amount <= 0 then
    return new;
  end if;

  v_due := public.compute_utility_payment_deadline(v_upload_at);

  insert into public.tenant_utility_obligations (
    property_id,
    tenant_id,
    lease_application_id,
    bill_month,
    amount,
    upload_at,
    due_date,
    status,
    updated_at
  )
  values (
    new.property_id,
    v_tenant_id,
    v_lease_id,
    new.bill_month,
    v_amount,
    v_upload_at,
    v_due,
    'pending',
    now()
  )
  on conflict (property_id, bill_month) do update
  set
    amount = excluded.amount,
    upload_at = excluded.upload_at,
    due_date = excluded.due_date,
    lease_application_id = excluded.lease_application_id,
    updated_at = now()
  where tenant_utility_obligations.status in ('pending', 'overdue');

  return new;
end;
$$;

drop trigger if exists trg_sync_tenant_utility_obligation on public.property_utility_bills;
create trigger trg_sync_tenant_utility_obligation
after insert or update on public.property_utility_bills
for each row
execute function public.sync_tenant_utility_obligation();
