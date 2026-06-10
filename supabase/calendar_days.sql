-- 日曆維度表：記錄 2030 年 1 月 1 日之前的每一日（1970-01-01 ～ 2029-12-31）
-- 供租期、入住日期、報表等查詢與篩選使用；可重複執行（idempotent）。

create table if not exists public.calendar_days (
  calendar_date date primary key,
  year int not null,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  year_month text not null,
  quarter int not null check (quarter between 1 and 4),
  day_of_week int not null check (day_of_week between 0 and 6),
  day_of_week_zh text not null,
  week_of_year int not null check (week_of_year between 1 and 53),
  is_weekend boolean not null,
  created_at timestamptz not null default now(),
  constraint calendar_days_before_2030 check (calendar_date < date '2030-01-01')
);

comment on table public.calendar_days is '日曆維度：2030 年以前的每一日（含年／月／週／是否週末）';
comment on column public.calendar_days.calendar_date is '日期（主鍵）';
comment on column public.calendar_days.day_of_week is '0=星期日 … 6=星期六（PostgreSQL dow）';
comment on column public.calendar_days.is_weekend is '星期六或星期日';

create index if not exists calendar_days_year_month_idx
  on public.calendar_days (year_month);

create index if not exists calendar_days_year_idx
  on public.calendar_days (year, month, day);

-- 填入 1970-01-01 至 2029-12-31
insert into public.calendar_days (
  calendar_date,
  year,
  month,
  day,
  year_month,
  quarter,
  day_of_week,
  day_of_week_zh,
  week_of_year,
  is_weekend
)
select
  d::date as calendar_date,
  extract(year from d)::int as year,
  extract(month from d)::int as month,
  extract(day from d)::int as day,
  to_char(d::date, 'YYYY-MM') as year_month,
  extract(quarter from d)::int as quarter,
  extract(dow from d)::int as day_of_week,
  case extract(dow from d)::int
    when 0 then '星期日'
    when 1 then '星期一'
    when 2 then '星期二'
    when 3 then '星期三'
    when 4 then '星期四'
    when 5 then '星期五'
    when 6 then '星期六'
  end as day_of_week_zh,
  extract(week from d)::int as week_of_year,
  extract(dow from d)::int in (0, 6) as is_weekend
from generate_series(
  date '1970-01-01',
  date '2029-12-31',
  interval '1 day'
) as g(d)
on conflict (calendar_date) do nothing;

alter table public.calendar_days enable row level security;

drop policy if exists "Anyone can read calendar days" on public.calendar_days;
create policy "Anyone can read calendar days"
on public.calendar_days
for select
to anon, authenticated
using (true);
