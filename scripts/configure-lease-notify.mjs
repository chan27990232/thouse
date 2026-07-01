/**
 * 將 .env / .env.local 的 Supabase URL 與 LEASE_REJECTION_NOTIFY_SECRET
 * 寫入 lease_notify_settings（供 DB trigger 呼叫 Edge Function）。
 *
 * 需 SUPABASE_DATABASE_URL 或 VITE_SUPABASE_URL + SUPABASE_DB_PASSWORD
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

const notifySecret = (process.env.LEASE_REJECTION_NOTIFY_SECRET || '').trim();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const connectionString =
  (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim() || null;
const ref = projectRefFromUrl(supabaseUrl);
const password =
  process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;

if (!notifySecret) {
  console.error('請在 .env.local 設定 LEASE_REJECTION_NOTIFY_SECRET（與 Edge Function secret 相同）。');
  process.exit(1);
}

const functionsBaseUrl = supabaseUrl.replace(/\/$/, '');
if (!functionsBaseUrl) {
  console.error('請設定 VITE_SUPABASE_URL 或 SUPABASE_URL。');
  process.exit(1);
}

let clientConfig;
if (connectionString) {
  clientConfig = { connectionString, ssl: { rejectUnauthorized: false } };
} else {
  if (!ref || !password) {
    console.error('請設定 SUPABASE_DATABASE_URL，或 VITE_SUPABASE_URL + SUPABASE_DB_PASSWORD。');
    process.exit(1);
  }
  clientConfig = {
    host: process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
  };
}

const client = new Client(clientConfig);
await client.connect();

try {
  await client.query(
    `update public.lease_notify_settings
       set functions_base_url = $1,
           notify_secret = $2,
           updated_at = now()
     where id = 1`,
    [functionsBaseUrl, notifySecret],
  );
  console.log('已更新 lease_notify_settings：');
  console.log('  functions_base_url =', functionsBaseUrl);
  console.log('  notify_secret = （已寫入，長度', notifySecret.length, '）');
} finally {
  await client.end();
}
