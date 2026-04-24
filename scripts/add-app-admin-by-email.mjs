/**
 * 依 email 將該帳加入 app_admins，供管理後台審核租盤、更新 properties。
 * 需：VITE_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、ADD_ADMIN_EMAIL
 *
 * Windows PowerShell 若出現「npm.ps1 cannot be loaded / running scripts is disabled」
 * 請不要用 npm，改在專根直接執行（略過執行原則）：
 *   $env:ADD_ADMIN_EMAIL="你的信箱"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="service_role 密鑰"
 *   $env:VITE_SUPABASE_URL="https://xxx.supabase.co"
 *   node .\scripts\add-app-admin-by-email.mjs
 * 或改用 cmd 執行 npm；或執行：Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvFile(p, override) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!k) continue;
    if (override) process.env[k] = v;
    else if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
}

loadEnvFile(join(root, '.env'), false);
loadEnvFile(join(root, '.env.local'), true);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADD_ADMIN_EMAIL || '').trim();

if (!supabaseUrl) {
  console.error('缺少 VITE_SUPABASE_URL（或 SUPABASE_URL）');
  process.exit(1);
}
if (!serviceKey) {
  console.error('缺少 SUPABASE_SERVICE_ROLE_KEY（Supabase → API → service_role）');
  process.exit(1);
}
if (!email) {
  console.error('請設定 ADD_ADMIN_EMAIL=你登入管理後台用的 email');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function findUserIdByEmail(e) {
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data?.users?.find((x) => (x.email ?? '').toLowerCase() === e.toLowerCase());
    if (u) return u.id;
    if (!data?.users?.length || data.users.length < perPage) break;
  }
  return null;
}

async function main() {
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    console.error(`找不到 email：${email}（請先在 Authentication 建此帳號或確認拼字）`);
    process.exit(1);
  }

  const { data: prof, error: pe } = await supabase.from('profiles').select('id, email').eq('id', userId).maybeSingle();
  if (pe) throw pe;
  if (!prof) {
    console.error(
      `public.profiles 沒有 id=${userId} 的列。請先用此帳登入主站 App 一次，或手動在 profiles 新增。`
    );
    process.exit(1);
  }

  const { error: ae } = await supabase.from('app_admins').upsert({ user_id: userId }, { onConflict: 'user_id' });
  if (ae) throw ae;

  console.log('已加入 app_admins。');
  console.log('  email: ' + email);
  console.log('  user_id: ' + userId);
  console.log('接著在專根執行：npm run db:admin-properties-policy（若未套用過 RLS 更新權限）');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
