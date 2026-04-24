/**
 * 本機執行：依序套用 supabase/*.sql
 *
 * 建議：到 Supabase → Project Settings → Database → 複製含密碼的
 *   Connection string（**URI**），貼到 .env.local：
 *     SUPABASE_DATABASE_URL=postgresql://...
 *   若出現 getaddrinfo ENOTFOUND，改用同一頁的 **Connection pooling**（Session 或 Transaction）的 URI，
 *   主機常為 ...pooler.supabase.com 而非 db.<ref>.supabase.co
 *
 * 或（擇一）用 SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL 組 db.<ref>.supabase.co
 * 密碼含空格時請加雙引號：SUPABASE_DB_PASSWORD="你的 密碼"
 *
 * 可選參數：單一 SQL 檔（相對專根或相對 supabase/）
 *   例：node scripts/apply-database.mjs supabase/cleanup_seed_properties.sql
 *   例：node scripts/apply-database.mjs cleanup_seed_properties.sql
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Client } = pg;
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

function projectRefFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const h = new URL(url).hostname;
    const m = h.match(/^([^.]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ref = projectRefFromUrl(supabaseUrl);
const password =
  process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
const connectionString =
  (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim() || null;

let clientConfig;

if (connectionString) {
  clientConfig = { connectionString, ssl: { rejectUnauthorized: false } };
} else {
  if (!ref) {
    console.error(
      '請在 .env 設定 VITE_SUPABASE_URL，或（建議）在 .env.local 設定 SUPABASE_DATABASE_URL=postgres://…'
    );
    process.exit(1);
  }
  if (!password) {
    console.error(
      '請設定 SUPABASE_DB_PASSWORD，或改用具密碼的完整 SUPABASE_DATABASE_URL（Supabase → Database 連線字串）。'
    );
    process.exit(1);
  }
  const host = process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
  const port = Number(process.env.SUPABASE_DB_PORT || 5432);
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  clientConfig = {
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
  };
}

/** 依賴順序；失敗時中斷並印出錯誤（多為 idempotent，可重跑） */
const SQL_FILES = [
  'profiles.sql',
  'properties.sql',
  'resolve_password_login_email.sql',
  'conversations.sql',
  'lease_applications.sql',
  'lease_applications_payment_columns.sql',
  'admin_support.sql',
  'landlord_verification.sql',
  'tenant_verification.sql',
  'ensure_property_storage_buckets.sql',
  'property_listing_verification.sql',
  'transaction_reviews.sql',
  'admin_properties_write.sql',
];

/**
 * @param {string} arg
 * @returns {string} absolute file path
 */
function resolveOneSqlFile(arg) {
  if (isAbsolute(arg) && existsSync(arg)) {
    return arg;
  }
  const underSupabase = join(root, 'supabase', arg);
  const underRoot = join(root, arg);
  if (arg.includes('supabase') && existsSync(underRoot)) {
    return underRoot;
  }
  if (existsSync(underSupabase)) {
    return underSupabase;
  }
  if (existsSync(underRoot)) {
    return underRoot;
  }
  console.error('找不到 SQL 檔，試過：', underSupabase, underRoot);
  process.exit(1);
  return '';
}

function safeConnectLog(cfg) {
  if (cfg.connectionString) {
    try {
      const u = new URL(cfg.connectionString.replace(/^postgres(ql)?:/i, 'https:'));
      console.log(`已連線：${u.hostname}:${u.port || '5432'}/${(u.pathname || '/').replace(/^\//, '') || 'postgres'}`);
    } catch {
      console.log('已連線（使用 SUPABASE_DATABASE_URL）');
    }
  } else {
    console.log(`已連線：${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  }
}

async function main() {
  const client = new Client(clientConfig);

  await client.connect();
  safeConnectLog(clientConfig);

  const single = process.argv[2];
  const toRun = single
    ? [resolveOneSqlFile(single)]
    : SQL_FILES.map((name) => join(root, 'supabase', name));

  try {
    for (const filePath of toRun) {
      if (!single && !existsSync(filePath)) {
        console.warn(`略過（檔案不存在）: ${basename(filePath)}`);
        continue;
      }
      const sql = readFileSync(filePath, 'utf8');
      const label = basename(filePath);
      console.log(`執行：${label} …`);
      await client.query(sql);
      console.log(`  ✓ ${label}`);
    }
    console.log('\n全部套用完成。');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
