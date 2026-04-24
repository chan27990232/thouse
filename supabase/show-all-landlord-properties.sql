drop policy if exists "Public can read available properties" on public.properties;

create policy "Public can read landlord properties"
on public.properties
for select
to anon, authenticated
using (
  public.is_landlord_profile(landlord_id)
);
