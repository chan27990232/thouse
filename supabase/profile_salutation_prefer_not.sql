-- 個人資料稱謂新增「不便透露」

alter table public.profiles drop constraint if exists profiles_salutation_check;

alter table public.profiles
  add constraint profiles_salutation_check
  check (salutation in ('', '先生', '女士', '不便透露'));
