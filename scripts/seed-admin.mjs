// 建立/更新內建管理員：username=admin, email=admin@thouse.local
// 需：SUPABASE_URL 或 VITE_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、ADMIN_SEED_PASSWORD
// PowerShell: 設定兩個 $env:... 後執行 npm run seed:admin
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
    if (k && v === undefined) continue;
    if (override) process.env[k] = v;
    else if (process.env[k] == null) process.env[k] = v;
  }
}

loadEnvFile(join(root, '.env'), false);
loadEnvFile(join(root, '.env.local'), true);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.ADMIN_SEED_PASSWORD;

if (!supabaseUrl) {
  console.error(
    '缺少 VITE_SUPABASE_URL（或 SUPABASE_URL）。請在專案根目錄建立 .env，或把 VITE_SUPABASE_URL 寫入 .env.local。'
  );
  process.exit(1);
}
if (!serviceKey) {
  console.error(
    '缺少 SUPABASE_SERVICE_ROLE_KEY。到 Supabase → Project Settings → API 複製 service_role 密鑰，寫入 .env.local 一行：\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=eyJ...'
  );
  process.exit(1);
}
if (password == null || password.length < 1) {
  console.error('請設定 ADMIN_SEED_PASSWORD，例如：$env:ADMIN_SEED_PASSWORD="你的密碼"（不寫入檔案較安全）。');
  process.exit(1);
}

const ADMIN_EMAIL = 'admin@thouse.local';
const ADMIN_USERNAME = 'admin';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function findUserIdByEmail(email) {
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data?.users?.find((x) => (x.email ?? '').toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (!data?.users?.length || data.users.length < perPage) break;
  }
  return null;
}

async function main() {
  const { data: taken, error: e1 } = await supabase
    .from('profiles')
    .select('id, email, username')
    .eq('username', ADMIN_USERNAME)
    .limit(1)
    .maybeSingle();

  if (e1) throw e1;
  if (taken && taken.email && taken.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error(
      `已存在 username「${ADMIN_USERNAME}」的帳戶（email: ${taken.email}），請更換內用 email 或手動合併。`
    );
  }

  let userId = await findUserIdByEmail(ADMIN_EMAIL);

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: '系統管理員',
        role: 'landlord',
        username: ADMIN_USERNAME,
      },
    });
    if (error) {
      if (String(error.message ?? '').toLowerCase().includes('registered') || error.status === 422) {
        userId = await findUserIdByEmail(ADMIN_EMAIL);
      }
      if (!userId) throw error;
    } else {
      userId = data.user.id;
    }
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: '系統管理員',
        role: 'landlord',
        username: ADMIN_USERNAME,
      },
    });
    if (error) throw error;
    if (data?.user) userId = data.user.id;
  }

  const { error: upErr } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: ADMIN_EMAIL,
      full_name: '系統管理員',
      username: ADMIN_USERNAME,
      salutation: '',
      phone: '',
      response_time: '',
      is_verified: true,
      role: 'landlord',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (upErr) throw upErr;

  const { error: adErr } = await supabase.from('app_admins').upsert(
    { user_id: userId },
    { onConflict: 'user_id' }
  );
  if (adErr) throw adErr;

  console.log('完成。');
  console.log('  用戶 ID（管理後台登入）: ' + ADMIN_USERNAME);
  console.log('  內部 email: ' + ADMIN_EMAIL);
  console.log('  密碼: 你透過 ADMIN_SEED_PASSWORD 設定的值。');
  console.log('  user_id (uuid): ' + userId);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
