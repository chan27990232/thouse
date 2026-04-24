-- 把示範租盤的業主改為指定 email 的房東（依 profiles.id = landlord_id）
-- 預設：landlord@thouse.local（可改下述 email 後在 SQL Editor 執行，或本機：npm run db:fix-landlord）

update public.properties p
set
  landlord_id = (select pl.id from public.profiles pl where pl.email = 'landlord@thouse.local' limit 1),
  updated_at = now()
where p.title in (
  '油麻地 雅賓大廈 劏房',
  '荃灣 村屋 劏房',
  '旺角 豪華公寓 劏房'
)
  and exists (select 1 from public.profiles pl where pl.email = 'landlord@thouse.local');
