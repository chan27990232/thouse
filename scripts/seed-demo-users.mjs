// 建立/更新示範帳戶：tenant_02、tenant_03、landlord_01、landlord_02
// 登入帳號 = username，密碼 = username，內部 email = username@thouse.local
// 需：VITE_SUPABASE_URL（或 SUPABASE_URL）、SUPABASE_SERVICE_ROLE_KEY（.env.local）
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

if (!supabaseUrl) {
  console.error('缺少 VITE_SUPABASE_URL（或 SUPABASE_URL）。');
  process.exit(1);
}
if (!serviceKey) {
  console.error('缺少 SUPABASE_SERVICE_ROLE_KEY（寫入 .env.local）。');
  process.exit(1);
}

const DEMO_USERS = [
  { username: 'tenant_02', role: 'tenant', fullName: '示範租客 02' },
  { username: 'tenant_03', role: 'tenant', fullName: '示範租客 03' },
  { username: 'landlord_01', role: 'landlord', fullName: '示範業主 01' },
  { username: 'landlord_02', role: 'landlord', fullName: '示範業主 02' },
];

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function internalEmail(username) {
  return `${username.trim().toLowerCase()}@thouse.local`;
}

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

async function upsertDemoUser({ username, role, fullName }) {
  const email = internalEmail(username);
  const password = username;

  const { data: taken, error: takenError } = await supabase
    .from('profiles')
    .select('id, email, username')
    .eq('username', username)
    .limit(1)
    .maybeSingle();

  if (takenError) throw takenError;
  if (taken && taken.email && taken.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error(`username「${username}」已被其他 email 使用（${taken.email}）`);
  }

  let userId = await findUserIdByEmail(email);

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, username },
    });
    if (error) {
      if (String(error.message ?? '').toLowerCase().includes('registered') || error.status === 422) {
        userId = await findUserIdByEmail(email);
      }
      if (!userId) throw error;
    } else {
      userId = data.user.id;
    }
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, username },
    });
    if (error) throw error;
    if (data?.user) userId = data.user.id;
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      username,
      salutation: '',
      phone: '',
      response_time: '',
      is_verified: true,
      role,
      is_deactivated: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (profileError) throw profileError;

  return { userId, username, email, role, password };
}

async function main() {
  console.log('建立示範帳戶…\n');
  for (const user of DEMO_USERS) {
    const result = await upsertDemoUser(user);
    console.log(`✓ ${result.username}`);
    console.log(`    角色: ${result.role}`);
    console.log(`    登入帳號: ${result.username}`);
    console.log(`    密碼: ${result.password}`);
    console.log(`    內部 email: ${result.email}`);
    console.log(`    user_id: ${result.userId}\n`);
  }
  console.log('全部完成。可用「登入帳號 + 密碼（同帳號名）」登入 App。');
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
