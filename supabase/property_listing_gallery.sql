-- 公開租盤相簿（主圖以外的室內圖 URL），並允許租客讀取實景佐證相片（不含房契）

alter table public.properties
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb;

comment on column public.properties.gallery_urls is '公開租盤相簿，JSON 字串陣列（公開 storage URL）';

drop policy if exists "public read listing proof media" on storage.objects;
create policy "public read listing proof media"
on storage.objects
for select
to public
using (
  bucket_id = 'property-verification'
  and strpos(name, '/proof-') > 0
);
