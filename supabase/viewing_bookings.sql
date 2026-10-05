-- 租客預約睇樓（1 或 2 小時，香港時間 09:00–18:00），業主可接受或忽略。
-- 執行：node scripts/apply-database.mjs viewing_bookings.sql

create table if not exists public.viewing_bookings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'ignored')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint viewing_bookings_duration_1_or_2h check (
    ends_at = starts_at + interval '1 hour'
    or ends_at = starts_at + interval '2 hours'
  )
);

alter table public.viewing_bookings drop constraint if exists viewing_bookings_two_hours;
alter table public.viewing_bookings drop constraint if exists viewing_bookings_duration_1_or_2h;
alter table public.viewing_bookings
  add constraint viewing_bookings_duration_1_or_2h check (
    ends_at = starts_at + interval '1 hour'
    or ends_at = starts_at + interval '2 hours'
  );


create index if not exists viewing_bookings_conversation_id_idx
  on public.viewing_bookings (conversation_id, starts_at);

create index if not exists viewing_bookings_landlord_pending_idx
  on public.viewing_bookings (landlord_id, status);

alter table public.viewing_bookings enable row level security;

drop policy if exists "Viewings: participants can select" on public.viewing_bookings;
create policy "Viewings: participants can select"
on public.viewing_bookings
for select
to authenticated
using (landlord_id = auth.uid() or tenant_id = auth.uid());

drop policy if exists "Viewings: tenant can insert" on public.viewing_bookings;
create policy "Viewings: tenant can insert"
on public.viewing_bookings
for insert
to authenticated
with check (
  tenant_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.tenant_id = auth.uid()
      and c.landlord_id = landlord_id
      and c.property_id = property_id
  )
);

create or replace function public.respond_to_viewing_booking(p_booking_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_decision not in ('accepted', 'ignored') then
    raise exception 'invalid_decision';
  end if;

  update public.viewing_bookings
  set status = p_decision,
      responded_at = now()
  where id = p_booking_id
    and landlord_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'viewing_not_found_or_not_pending';
  end if;
end;
$$;

revoke all on function public.respond_to_viewing_booking(uuid, text) from public;
grant execute on function public.respond_to_viewing_booking(uuid, text) to authenticated;
