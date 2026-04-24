create or replace function public.get_public_landlord_profile(profile_id uuid)
returns table (
  full_name text,
  salutation text,
  phone text,
  email text,
  response_time text,
  is_verified boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.full_name,
    p.salutation,
    p.phone,
    p.email,
    p.response_time,
    p.is_verified
  from public.profiles p
  where p.id = profile_id
    and p.role = 'landlord'
  limit 1;
$$;

revoke all on function public.get_public_landlord_profile(uuid) from public;
grant execute on function public.get_public_landlord_profile(uuid) to anon, authenticated;
