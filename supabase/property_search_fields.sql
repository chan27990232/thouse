-- 租客搜尋篩選欄位：房間配置、大廈設施、樓齡
alter table public.properties add column if not exists room_features text[] not null default '{}';
alter table public.properties add column if not exists amenities text[] not null default '{}';
alter table public.properties add column if not exists building_age text
  check (building_age is null or building_age in ('new', '5-10', '10-20', '20+'));

comment on column public.properties.room_features is '房間配置（canonical 繁中 key，對應搜尋篩選）';
comment on column public.properties.amenities is '大廈設施（canonical 繁中 key）';
comment on column public.properties.building_age is '樓齡區間：new | 5-10 | 10-20 | 20+';

alter table public.properties add column if not exists school_net text not null default '';

comment on column public.properties.school_net is '小學校網（canonical 繁中 key，對應 HK_SCHOOL_NETS）';
