-- 香港公眾假期欄位（對應 calendar_days）
-- 資料來源：政府憲報公布之一般公眾假期（不含每週日）
-- 變動農曆／復活節日期由 scripts/seed-hk-public-holidays.mjs 填入（2010–2029）
-- 固定假期（元旦、勞動節、七一、國慶、聖誕）1970–2029 由本檔自動產生

alter table public.calendar_days
  add column if not exists is_public_holiday boolean not null default false,
  add column if not exists public_holiday_name_zh text,
  add column if not exists public_holiday_name_en text;

comment on column public.calendar_days.is_public_holiday is '是否香港公眾假期（憲報公布，不含每週日）';
comment on column public.calendar_days.public_holiday_name_zh is '公眾假期名稱（繁體中文）';
comment on column public.calendar_days.public_holiday_name_en is '公眾假期名稱（英文）';

create table if not exists public.hong_kong_public_holidays (
  holiday_date date primary key,
  name_zh text not null,
  name_en text not null,
  constraint hk_public_holidays_before_2030 check (holiday_date < date '2030-01-01'),
  constraint hk_public_holidays_in_calendar
    foreign key (holiday_date) references public.calendar_days (calendar_date) on delete cascade
);

comment on table public.hong_kong_public_holidays is '香港公眾假期主檔（憲報公布之一般公眾假期）';

create index if not exists hong_kong_public_holidays_year_idx
  on public.hong_kong_public_holidays ((extract(year from holiday_date)));

alter table public.hong_kong_public_holidays enable row level security;

drop policy if exists "Anyone can read HK public holidays" on public.hong_kong_public_holidays;
create policy "Anyone can read HK public holidays"
on public.hong_kong_public_holidays
for select
to anon, authenticated
using (true);

-- 1970–2029 固定公眾假期
insert into public.hong_kong_public_holidays (holiday_date, name_zh, name_en)
select
  d::date,
  v.name_zh,
  v.name_en
from generate_series(date '1970-01-01', date '2029-12-31', interval '1 day') as g(d)
cross join lateral (
  values
    (1, 1, '一月一日', 'New Year''s Day'),
    (5, 1, '勞動節', 'Labour Day'),
    (7, 1, '香港特別行政區成立紀念日', 'Hong Kong SAR Establishment Day'),
    (10, 1, '國慶日', 'National Day'),
    (12, 25, '聖誕節', 'Christmas Day')
) as v(month_num, day_num, name_zh, name_en)
where extract(month from d) = v.month_num
  and extract(day from d) = v.day_num
on conflict (holiday_date) do update
set name_zh = excluded.name_zh,
    name_en = excluded.name_en;

create or replace function public.sync_calendar_public_holidays()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.calendar_days
  set
    is_public_holiday = false,
    public_holiday_name_zh = null,
    public_holiday_name_en = null;

  update public.calendar_days cd
  set
    is_public_holiday = true,
    public_holiday_name_zh = h.name_zh,
    public_holiday_name_en = h.name_en
  from public.hong_kong_public_holidays h
  where cd.calendar_date = h.holiday_date;
end;
$$;

comment on function public.sync_calendar_public_holidays() is
  '將 hong_kong_public_holidays 同步至 calendar_days 公眾假期欄位';

select public.sync_calendar_public_holidays();

create index if not exists calendar_days_public_holiday_idx
  on public.calendar_days (is_public_holiday)
  where is_public_holiday;
