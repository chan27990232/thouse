-- 業主租約變更申請附件（每筆申請最多 10 個檔案、合計 10GB，由應用層驗證）
-- 須已執行 lease_management_requests_workflow.sql

create table if not exists public.lease_management_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.lease_management_requests (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists lease_management_request_files_request_idx
  on public.lease_management_request_files (request_id);

alter table public.lease_management_request_files enable row level security;

drop policy if exists "Landlords read own lease management request files" on public.lease_management_request_files;
create policy "Landlords read own lease management request files"
on public.lease_management_request_files for select to authenticated
using (
  exists (
    select 1 from public.lease_management_requests r
    where r.id = request_id and r.landlord_id = (select auth.uid())
  )
);

drop policy if exists "Admins read all lease management request files" on public.lease_management_request_files;
create policy "Admins read all lease management request files"
on public.lease_management_request_files for select to authenticated
using (public.is_app_admin());

grant select on public.lease_management_request_files to authenticated;

insert into storage.buckets (id, name, public)
values ('lease-management-requests', 'lease-management-requests', false)
on conflict (id) do nothing;

drop policy if exists "landlord insert lease management request files" on storage.objects;
create policy "landlord insert lease management request files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lease-management-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "landlord read own lease management request files storage" on storage.objects;
create policy "landlord read own lease management request files storage"
on storage.objects for select to authenticated
using (
  bucket_id = 'lease-management-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "admin read lease management request files storage" on storage.objects;
create policy "admin read lease management request files storage"
on storage.objects for select to authenticated
using (
  bucket_id = 'lease-management-requests'
  and public.is_app_admin()
);

create or replace function public.register_lease_management_request_files(
  p_request_id uuid,
  p_files jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landlord uuid;
  v_count int;
  v_item jsonb;
  v_total bigint := 0;
  v_new_total bigint;
begin
  select r.landlord_id into v_landlord
  from public.lease_management_requests r
  where r.id = p_request_id and r.status = 'pending';

  if v_landlord is null then
    raise exception '找不到待審核的申請';
  end if;

  if v_landlord is distinct from (select auth.uid()) then
    raise exception '無權上傳此申請的附件';
  end if;

  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    return;
  end if;

  select count(*)::int into v_count from public.lease_management_request_files where request_id = p_request_id;
  if v_count + jsonb_array_length(p_files) > 10 then
    raise exception '每筆申請最多 10 個附件';
  end if;

  select coalesce(sum(file_size_bytes), 0) into v_total
  from public.lease_management_request_files
  where request_id = p_request_id;

  for v_item in select * from jsonb_array_elements(p_files)
  loop
    v_new_total := v_total + (v_item->>'file_size_bytes')::bigint;
    if v_new_total > 10737418240 then
      raise exception '附件總大小不可超過 10GB';
    end if;
    insert into public.lease_management_request_files (
      request_id, file_name, storage_path, file_size_bytes, mime_type
    )
    values (
      p_request_id,
      v_item->>'file_name',
      v_item->>'storage_path',
      (v_item->>'file_size_bytes')::bigint,
      nullif(v_item->>'mime_type', '')
    );
    v_total := v_new_total;
  end loop;
end;
$$;

grant execute on function public.register_lease_management_request_files(uuid, jsonb) to authenticated;
