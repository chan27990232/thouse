-- 聊天附件 Storage（公開讀、登入用戶可上傳至本人資料夾）
-- 執行：node scripts/apply-database.mjs chat_attachments_storage.sql

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do update
set public = excluded.public, name = excluded.name;

drop policy if exists "public read chat attachments" on storage.objects;
create policy "public read chat attachments"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'chat-attachments');

drop policy if exists "users own folder insert chat attachment" on storage.objects;
create policy "users own folder insert chat attachment"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and auth.uid() is not null
  and ltrim(name, '/') like (auth.uid()::text || '/%')
);

drop policy if exists "users own folder delete chat attachment" on storage.objects;
create policy "users own folder delete chat attachment"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and auth.uid() is not null
  and ltrim(name, '/') like (auth.uid()::text || '/%')
);
