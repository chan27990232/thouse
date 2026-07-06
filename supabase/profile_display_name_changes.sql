-- 用戶名稱（profiles.full_name）每 14 天最多修改 2 次

create table if not exists public.profile_display_name_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  changed_at timestamptz not null default now(),
  old_name text not null default '',
  new_name text not null default ''
);

create index if not exists profile_display_name_changes_user_changed_at_idx
  on public.profile_display_name_changes (user_id, changed_at desc);

alter table public.profile_display_name_changes enable row level security;

drop policy if exists "Users can read own display name changes" on public.profile_display_name_changes;
create policy "Users can read own display name changes"
  on public.profile_display_name_changes
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.enforce_profile_display_name_change_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  change_count int;
begin
  if new.full_name is not distinct from old.full_name then
    return new;
  end if;

  select count(*)::int
  into change_count
  from public.profile_display_name_changes
  where user_id = new.id
    and changed_at > now() - interval '14 days';

  if change_count >= 2 then
    raise exception 'display_name_change_limit'
      using hint = 'Display name can only be changed twice every 14 days';
  end if;

  insert into public.profile_display_name_changes (user_id, old_name, new_name)
  values (new.id, coalesce(old.full_name, ''), coalesce(new.full_name, ''));

  return new;
end;
$$;

drop trigger if exists profiles_display_name_change_limit on public.profiles;
create trigger profiles_display_name_change_limit
  before update of full_name on public.profiles
  for each row
  execute function public.enforce_profile_display_name_change_limit();

create or replace function public.get_display_name_change_quota()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'changes_in_window',
    coalesce(
      (
        select count(*)::int
        from public.profile_display_name_changes
        where user_id = auth.uid()
          and changed_at > now() - interval '14 days'
      ),
      0
    ),
    'max_changes', 2,
    'window_days', 14
  );
$$;

revoke all on function public.get_display_name_change_quota() from public;
grant execute on function public.get_display_name_change_quota() to authenticated;
