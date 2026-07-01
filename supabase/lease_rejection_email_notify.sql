-- 租約申請 status → rejected 時，以 pg_net 呼叫 Edge Function notify-lease-rejection 寄電郵給租客。
--
-- 部署步驟：
--   1. npm run deploy:notify-lease-rejection（Windows 建議；需 SUPABASE_ACCESS_TOKEN）
--      或 npx supabase@2.20.12 functions deploy notify-lease-rejection --project-ref <ref> --use-api
--   2. Supabase → Edge Functions → Secrets：
--        RESEND_API_KEY
--        LEASE_REJECTION_FROM_EMAIL（例：T-House Limited <noreply@thousehk.com>，需先在 Resend 驗證 thousehk.com）
--        LEASE_REJECTION_NOTIFY_SECRET=<隨機長字串>
--        PUBLIC_APP_URL=https://你的正式網域
--   3. node scripts/configure-lease-notify.mjs  （或手動 UPDATE lease_notify_settings）
--   4. node scripts/apply-database.mjs lease_rejection_email_notify.sql

create extension if not exists pg_net with schema extensions;

create table if not exists public.lease_rejection_emails_sent (
  application_id uuid primary key references public.lease_applications (id) on delete cascade,
  sent_at timestamptz not null default now()
);

comment on table public.lease_rejection_emails_sent is
  '已寄出租約拒絕通知的申請（防重複寄信）';

alter table public.lease_rejection_emails_sent enable row level security;

create table if not exists public.lease_notify_settings (
  id smallint primary key default 1 check (id = 1),
  functions_base_url text not null default '',
  notify_secret text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.lease_notify_settings is
  'DB trigger 呼叫 Edge Function 的設定（functions_base_url、notify_secret）';

insert into public.lease_notify_settings (id, functions_base_url, notify_secret)
values (1, '', '')
on conflict (id) do nothing;

alter table public.lease_notify_settings enable row level security;

create or replace function public.trg_lease_application_rejected_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_base_url text;
  v_secret text;
  v_body jsonb;
begin
  if old.status is not distinct from 'rejected' or new.status is distinct from 'rejected' then
    return new;
  end if;

  select functions_base_url, notify_secret
    into v_base_url, v_secret
    from public.lease_notify_settings
    where id = 1;

  if v_base_url is null or trim(v_base_url) = '' then
    raise warning 'lease_notify_settings.functions_base_url 未設定，略過拒絕通知郵件';
    return new;
  end if;

  if v_secret is null or trim(v_secret) = '' then
    raise warning 'lease_notify_settings.notify_secret 未設定，略過拒絕通知郵件';
    return new;
  end if;

  v_body := jsonb_build_object(
    'application_id', new.id,
    'previous_status', old.status
  );

  perform net.http_post(
    url := rtrim(v_base_url, '/') || '/functions/v1/notify-lease-rejection',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-lease-notify-secret', v_secret
    ),
    body := v_body
  );

  return new;
exception
  when undefined_function then
    raise warning 'pg_net 未啟用，略過租約拒絕通知郵件';
    return new;
  when others then
    raise warning '租約拒絕通知 enqueue 失敗：%', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_lease_application_rejected_email on public.lease_applications;
create trigger trg_lease_application_rejected_email
after update on public.lease_applications
for each row
execute function public.trg_lease_application_rejected_notify();
