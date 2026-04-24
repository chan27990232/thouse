create or replace function public.is_landlord_profile(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = profile_id
      and role = 'landlord'
  );
$$;

revoke all on function public.is_landlord_profile(uuid) from public;
grant execute on function public.is_landlord_profile(uuid) to anon, authenticated;

drop policy if exists "Public can read available properties" on public.properties;
create policy "Public can read available properties"
on public.properties
for select
to anon, authenticated
using (
  status in ('available', 'rented')
  and public.is_landlord_profile(landlord_id)
);
