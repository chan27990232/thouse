-- 業主錢包：公司轉交業主（landlord_payout_status = paid）時入帳；業主可申請提現
-- 須在 admin_property_manage.sql 之後執行

-- ========== 錢包與流水 ==========
create table if not exists public.landlord_wallets (
  landlord_id uuid primary key references public.profiles (id) on delete cascade,
  available_balance numeric(12, 2) not null default 0 check (available_balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.landlord_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  entry_type text not null check (entry_type in ('payout_credit', 'withdrawal_hold', 'withdrawal_reversal')),
  source_type text not null check (source_type in ('lease_initial', 'rent', 'utility', 'withdrawal')),
  source_id uuid,
  description text not null default '',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists landlord_wallet_ledger_landlord_created_idx
  on public.landlord_wallet_ledger (landlord_id, created_at desc);

comment on table public.landlord_wallets is '業主可提現餘額';
comment on table public.landlord_wallet_ledger is '業主錢包流水（入帳／提現扣款／提現駁回退回）';

-- ========== 提現申請 ==========
create table if not exists public.landlord_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payout_method text not null default 'bank_transfer'
    check (payout_method in ('bank_transfer', 'fps')),
  bank_name text not null default '',
  account_holder text not null default '',
  account_number text not null default '',
  fps_id text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'rejected')),
  admin_notes text not null default '',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  ledger_entry_id uuid references public.landlord_wallet_ledger (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint landlord_withdrawal_bank_chk check (
    payout_method <> 'bank_transfer'
    or (btrim(bank_name) <> '' and btrim(account_holder) <> '' and btrim(account_number) <> '')
  ),
  constraint landlord_withdrawal_fps_chk check (
    payout_method <> 'fps' or btrim(fps_id) <> ''
  )
);

create index if not exists landlord_withdrawal_requests_status_created_idx
  on public.landlord_withdrawal_requests (status, created_at desc);

create index if not exists landlord_withdrawal_requests_landlord_idx
  on public.landlord_withdrawal_requests (landlord_id, created_at desc);

comment on table public.landlord_withdrawal_requests is '業主提現申請，由管理員審核後出款';

-- ========== 入帳核心（冪等） ==========
create or replace function public._landlord_wallet_credit(
  p_landlord_id uuid,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_landlord_id is null or p_amount is null or p_amount <= 0 then
    return;
  end if;

  v_key := p_source_type || ':' || p_source_id::text;

  begin
    insert into public.landlord_wallet_ledger (
      landlord_id, amount, entry_type, source_type, source_id, description, idempotency_key
    ) values (
      p_landlord_id, p_amount, 'payout_credit', p_source_type, p_source_id, coalesce(p_description, ''), v_key
    );
  exception
    when unique_violation then
      return;
  end;

  insert into public.landlord_wallets (landlord_id, available_balance)
  values (p_landlord_id, p_amount)
  on conflict (landlord_id) do update
  set available_balance = public.landlord_wallets.available_balance + excluded.available_balance,
      updated_at = now();
end;
$$;

-- ========== 轉交業主 → 入帳觸發器 ==========
create or replace function public.trg_landlord_payout_credit_lease()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
     and (OLD.landlord_payout_status is distinct from 'paid')
     and NEW.landlord_payout_status = 'paid' then
    perform public._landlord_wallet_credit(
      NEW.landlord_id,
      NEW.first_payment_total::numeric,
      'lease_initial',
      NEW.id,
      '簽約首期租金'
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_landlord_payout_credit_lease on public.lease_applications;
create trigger trg_landlord_payout_credit_lease
after update of landlord_payout_status on public.lease_applications
for each row
execute function public.trg_landlord_payout_credit_lease();

create or replace function public.trg_landlord_payout_credit_rent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
     and (OLD.landlord_payout_status is distinct from 'paid')
     and NEW.landlord_payout_status = 'paid' then
    perform public._landlord_wallet_credit(
      NEW.landlord_id,
      NEW.amount::numeric,
      'rent',
      NEW.id,
      '第 ' || NEW.period_index::text || ' 期租金'
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_landlord_payout_credit_rent on public.rent_payments;
create trigger trg_landlord_payout_credit_rent
after update of landlord_payout_status on public.rent_payments
for each row
execute function public.trg_landlord_payout_credit_rent();

create or replace function public.trg_landlord_payout_credit_utility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landlord_id uuid;
begin
  if TG_OP = 'UPDATE'
     and (OLD.landlord_payout_status is distinct from 'paid')
     and NEW.landlord_payout_status = 'paid' then
    select p.landlord_id into v_landlord_id
    from public.properties p
    where p.id = NEW.property_id;

    if v_landlord_id is not null then
      perform public._landlord_wallet_credit(
        v_landlord_id,
        NEW.amount,
        'utility',
        NEW.id,
        to_char(NEW.bill_month, 'YYYY-MM') || ' 水電煤'
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_landlord_payout_credit_utility on public.tenant_utility_obligations;
create trigger trg_landlord_payout_credit_utility
after update of landlord_payout_status on public.tenant_utility_obligations
for each row
execute function public.trg_landlord_payout_credit_utility();

-- ========== 既有「已轉交」紀錄補入帳（冪等） ==========
do $$
declare
  r record;
  v_lid uuid;
begin
  for r in
    select id, landlord_id, first_payment_total
    from public.lease_applications
    where landlord_payout_status = 'paid'
  loop
    perform public._landlord_wallet_credit(
      r.landlord_id, r.first_payment_total::numeric, 'lease_initial', r.id, '簽約首期租金（補登）'
    );
  end loop;

  for r in
    select id, landlord_id, amount, period_index
    from public.rent_payments
    where landlord_payout_status = 'paid'
  loop
    perform public._landlord_wallet_credit(
      r.landlord_id, r.amount::numeric, 'rent', r.id, '第 ' || r.period_index::text || ' 期租金（補登）'
    );
  end loop;

  for r in
    select u.id, u.amount, u.bill_month, p.landlord_id
    from public.tenant_utility_obligations u
    join public.properties p on p.id = u.property_id
    where u.landlord_payout_status = 'paid'
  loop
    perform public._landlord_wallet_credit(
      r.landlord_id, r.amount, 'utility', r.id, to_char(r.bill_month, 'YYYY-MM') || ' 水電煤（補登）'
    );
  end loop;
end;
$$;

-- ========== 業主提現 RPC ==========
create or replace function public.submit_landlord_withdrawal(
  p_amount numeric,
  p_payout_method text,
  p_bank_name text default '',
  p_account_holder text default '',
  p_account_number text default '',
  p_fps_id text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_bal numeric(12, 2);
  v_req_id uuid;
  v_ledger_id uuid;
  v_key text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception '請先登入';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception '提現金額須大於零';
  end if;

  if p_payout_method not in ('bank_transfer', 'fps') then
    raise exception '不支援的收款方式';
  end if;

  if p_payout_method = 'bank_transfer' then
    if btrim(coalesce(p_bank_name, '')) = ''
       or btrim(coalesce(p_account_holder, '')) = ''
       or btrim(coalesce(p_account_number, '')) = '' then
      raise exception '請填寫完整銀行帳戶資料';
    end if;
  else
    if btrim(coalesce(p_fps_id, '')) = '' then
      raise exception '請填寫轉數快識別碼（電話／電郵／FPS ID）';
    end if;
  end if;

  insert into public.landlord_wallets (landlord_id, available_balance)
  values (v_uid, 0)
  on conflict (landlord_id) do nothing;

  select available_balance into v_bal
  from public.landlord_wallets
  where landlord_id = v_uid
  for update;

  if coalesce(v_bal, 0) < p_amount then
    raise exception '可用餘額不足（目前 HK$%）', coalesce(v_bal, 0);
  end if;

  insert into public.landlord_withdrawal_requests (
    landlord_id, amount, payout_method, bank_name, account_holder, account_number, fps_id
  ) values (
    v_uid,
    p_amount,
    p_payout_method,
    coalesce(p_bank_name, ''),
    coalesce(p_account_holder, ''),
    coalesce(p_account_number, ''),
    coalesce(p_fps_id, '')
  )
  returning id into v_req_id;

  v_key := 'withdrawal:' || v_req_id::text;

  insert into public.landlord_wallet_ledger (
    landlord_id, amount, entry_type, source_type, source_id, description, idempotency_key
  ) values (
    v_uid,
    -p_amount,
    'withdrawal_hold',
    'withdrawal',
    v_req_id,
    '提現申請扣款',
    v_key
  )
  returning id into v_ledger_id;

  update public.landlord_withdrawal_requests
  set ledger_entry_id = v_ledger_id
  where id = v_req_id;

  update public.landlord_wallets
  set available_balance = available_balance - p_amount,
      updated_at = now()
  where landlord_id = v_uid;

  return v_req_id;
end;
$$;

revoke all on function public.submit_landlord_withdrawal(numeric, text, text, text, text, text) from public;
grant execute on function public.submit_landlord_withdrawal(numeric, text, text, text, text, text) to authenticated;

-- ========== 管理員處理提現 RPC ==========
create or replace function public.admin_process_landlord_withdrawal(
  p_request_id uuid,
  p_action text,
  p_admin_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_key text;
begin
  if not public.is_app_admin() then
    raise exception '需要管理員權限';
  end if;

  if p_action not in ('processing', 'paid', 'rejected') then
    raise exception '無效操作';
  end if;

  select * into v_req
  from public.landlord_withdrawal_requests
  where id = p_request_id
  for update;

  if v_req.id is null then
    raise exception '找不到提現申請';
  end if;

  if v_req.status in ('paid', 'rejected') then
    raise exception '此申請已結案';
  end if;

  if p_action = 'processing' then
    update public.landlord_withdrawal_requests
    set status = 'processing',
        admin_notes = coalesce(nullif(btrim(p_admin_notes), ''), admin_notes)
    where id = p_request_id;
    return;
  end if;

  if p_action = 'paid' then
    update public.landlord_withdrawal_requests
    set status = 'paid',
        admin_notes = coalesce(nullif(btrim(p_admin_notes), ''), admin_notes),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = p_request_id;
    return;
  end if;

  -- rejected：退回餘額
  v_key := 'withdrawal_reversal:' || v_req.id::text;

  begin
    insert into public.landlord_wallet_ledger (
      landlord_id, amount, entry_type, source_type, source_id, description, idempotency_key
    ) values (
      v_req.landlord_id,
      v_req.amount,
      'withdrawal_reversal',
      'withdrawal',
      v_req.id,
      '提現申請駁回退回',
      v_key
    );
  exception
    when unique_violation then
      null;
  end;

  update public.landlord_wallets
  set available_balance = available_balance + v_req.amount,
      updated_at = now()
  where landlord_id = v_req.landlord_id;

  update public.landlord_withdrawal_requests
  set status = 'rejected',
      admin_notes = coalesce(nullif(btrim(p_admin_notes), ''), admin_notes),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_request_id;
end;
$$;

revoke all on function public.admin_process_landlord_withdrawal(uuid, text, text) from public;
grant execute on function public.admin_process_landlord_withdrawal(uuid, text, text) to authenticated;

-- ========== RLS ==========
alter table public.landlord_wallets enable row level security;
alter table public.landlord_wallet_ledger enable row level security;
alter table public.landlord_withdrawal_requests enable row level security;

drop policy if exists "Landlords read own wallet" on public.landlord_wallets;
create policy "Landlords read own wallet"
on public.landlord_wallets for select to authenticated
using (landlord_id = (select auth.uid()));

drop policy if exists "Admins read all wallets" on public.landlord_wallets;
create policy "Admins read all wallets"
on public.landlord_wallets for select to authenticated
using (public.is_app_admin());

drop policy if exists "Landlords read own wallet ledger" on public.landlord_wallet_ledger;
create policy "Landlords read own wallet ledger"
on public.landlord_wallet_ledger for select to authenticated
using (landlord_id = (select auth.uid()));

drop policy if exists "Admins read all wallet ledger" on public.landlord_wallet_ledger;
create policy "Admins read all wallet ledger"
on public.landlord_wallet_ledger for select to authenticated
using (public.is_app_admin());

drop policy if exists "Landlords read own withdrawal requests" on public.landlord_withdrawal_requests;
create policy "Landlords read own withdrawal requests"
on public.landlord_withdrawal_requests for select to authenticated
using (landlord_id = (select auth.uid()));

drop policy if exists "Admins read all withdrawal requests" on public.landlord_withdrawal_requests;
create policy "Admins read all withdrawal requests"
on public.landlord_withdrawal_requests for select to authenticated
using (public.is_app_admin());

grant select on public.landlord_wallets to authenticated;
grant select on public.landlord_wallet_ledger to authenticated;
grant select on public.landlord_withdrawal_requests to authenticated;
