-- 允許在「更改個人資料」畫面更新電話與 Email（移除先前僅限檢視的鎖定）

drop trigger if exists trg_profiles_contact_fields_guard on public.profiles;
drop function if exists public.trg_profiles_contact_fields_guard();
