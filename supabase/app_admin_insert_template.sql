-- 將管理後台登入帳號加入 app_admins（審核租盤、以管理員權限更新 properties 所必需）
--
-- 步驟：
-- 1) Supabase → Authentication → Users → 點你登入管理後台用的帳號 → 複製 User UID
-- 2) 到 Table Editor 確認 public.profiles 有同一個 id 的列（沒有：先用該帳「登入一次主站 App」讓觸發器建立，或手動在 profiles 新增該 id）
-- 3) 把下面 YOUR_USER_ID 整段換成上一步的 UUID（保留引號）
-- 4) 在 SQL Editor 執行本腳本
-- 5) 再執行（若未跑過）：npm run db:admin-properties-policy
--
-- （重跑不會多筆：on conflict 略過）
insert into public.app_admins (user_id)
values ('YOUR_USER_ID'::uuid)
on conflict (user_id) do nothing;
