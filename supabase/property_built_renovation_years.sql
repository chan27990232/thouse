-- Built year + renovation year for landlord listings.
-- Keep building_age buckets for existing tenant search filters (derived from built_year in app).

alter table public.properties
  add column if not exists built_year integer;

alter table public.properties
  add column if not exists renovation_year integer;

comment on column public.properties.built_year is '物業建成年份（西元），刊登必填';
comment on column public.properties.renovation_year is '裝修年份（西元），刊登必填；若未裝修可填與建成年份相同';

alter table public.properties drop constraint if exists properties_built_year_range;
alter table public.properties
  add constraint properties_built_year_range
  check (built_year is null or (built_year >= 1800 and built_year <= 2100));

alter table public.properties drop constraint if exists properties_renovation_year_range;
alter table public.properties
  add constraint properties_renovation_year_range
  check (renovation_year is null or (renovation_year >= 1800 and renovation_year <= 2100));
