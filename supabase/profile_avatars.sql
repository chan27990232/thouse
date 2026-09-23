-- 個人頭像：profiles.avatar_url + 公開 Storage bucket
-- 執行：node scripts/apply-database.mjs profile_avatars.sql

alter table public.profiles
  add column if not exists avatar_url text not null default '';

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update
set public = excluded.public, name = excluded.name;

drop policy if exists "public read profile avatars" on storage.objects;
create policy "public read profile avatars"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'profile-avatars');

drop policy if exists "users own folder insert profile avatar" on storage.objects;
create policy "users own folder insert profile avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and auth.uid() is not null
  and ltrim(name, '/') like (auth.uid()::text || '/%')
);

drop policy if exists "users own folder update profile avatar" on storage.objects;
create policy "users own folder update profile avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and auth.uid() is not null
  and ltrim(name, '/') like (auth.uid()::text || '/%')
)
with check (
  bucket_id = 'profile-avatars'
  and auth.uid() is not null
  and ltrim(name, '/') like (auth.uid()::text || '/%')
);

drop policy if exists "users own folder delete profile avatar" on storage.objects;
create policy "users own folder delete profile avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and auth.uid() is not null
  and ltrim(name, '/') like (auth.uid()::text || '/%')
);
