-- 刪除「同房東、同標題」的重複筆，只保留 id 較小的一筆（UUID 比較）
-- 在 SQL Editor 或：npm run db:apply -- 後面接此檔名
-- 注意：若業務上允許同房東兩筆完全同名租盤，請勿執行；一般應以不同 title 區分

delete from public.properties p
where exists (
  select 1
  from public.properties x
  where x.landlord_id is not null
    and x.landlord_id = p.landlord_id
    and trim(coalesce(x.title, '')) = trim(coalesce(p.title, ''))
    and trim(coalesce(p.title, '')) <> ''
    and x.id < p.id
);
