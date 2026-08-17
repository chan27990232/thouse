-- 登入密碼每 14 天最多修改 1 次（已登入「更改個人資料」流程）

create table if not exists public.profile_password_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  changed_at timestamptz not null default now()
);

create index if not exists profile_password_changes_user_changed_at_idx
  on public.profile_password_changes (user_id, changed_at desc);

alter table public.profile_password_changes enable row level security;

drop policy if exists "Users can read own password changes" on public.profile_password_changes;
create policy "Users can read own password changes"
  on public.profile_password_changes
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.get_password_change_quota()
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
        from public.profile_password_changes
        where user_id = auth.uid()
          and changed_at > now() - interval '14 days'
      ),
      0
    ),
    'max_changes', 1,
    'window_days', 14
  );
$$;

revoke all on function public.get_password_change_quota() from public;
grant execute on function public.get_password_change_quota() to authenticated;

-- 先佔用額度再改密碼；失敗時可呼叫 undo 退回
create or replace function public.claim_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  change_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select count(*)::int
  into change_count
  from public.profile_password_changes
  where user_id = auth.uid()
    and changed_at > now() - interval '14 days';

  if change_count >= 1 then
    raise exception 'password_change_limit'
      using hint = 'Password can only be changed once every 14 days';
  end if;

  insert into public.profile_password_changes (user_id)
  values (auth.uid());
end;
$$;

revoke all on function public.claim_password_change() from public;
grant execute on function public.claim_password_change() to authenticated;

create or replace function public.undo_latest_password_change_claim()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  delete from public.profile_password_changes
  where id = (
    select id
    from public.profile_password_changes
    where user_id = auth.uid()
      and changed_at > now() - interval '5 minutes'
    order by changed_at desc
    limit 1
  );
end;
$$;

revoke all on function public.undo_latest_password_change_claim() from public;
grant execute on function public.undo_latest_password_change_claim() to authenticated;
