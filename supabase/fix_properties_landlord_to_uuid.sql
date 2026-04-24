-- 將示範三筆租盤的業主固定為此 UUID（與用戶頁 landlord@thouse.local 一致）
-- 可重跑；僅在 profiles 已存在該 id 時成功

update public.properties p
set
  landlord_id = '1e2e499b-d642-433d-a728-086ecc0bb331'::uuid,
  updated_at = now()
where p.title in (
  '油麻地 雅賓大廈 劏房',
  '荃灣 村屋 劏房',
  '旺角 豪華公寓 劏房'
)
  and exists (
    select 1
    from public.profiles pl
    where pl.id = '1e2e499b-d642-433d-a728-086ecc0bb331'
  );
