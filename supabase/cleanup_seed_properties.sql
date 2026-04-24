-- 刪除 supabase/seed-properties.sql 插入的三筆示範盤（僅在 landlord 帳戶、標題完全相符時刪除）
-- 不影響同標題但不同房東的列（幾率極低）

delete from public.properties
where title in (
  '油麻地 雅賓大廈 劏房',
  '荃灣 村屋 劏房',
  '旺角 豪華公寓 劏房'
)
  and landlord_id = (select p.id from public.profiles p where p.username = 'landlord' limit 1);
