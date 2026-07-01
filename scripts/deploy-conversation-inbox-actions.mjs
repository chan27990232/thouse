/**
 * 套用 conversation_inbox_actions.sql 並 reload PostgREST schema。
 * 使用與 apply-database.mjs 相同的 .env / .env.local 連線設定。
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

const connectionString =
  (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim() || null;

if (!connectionString) {
  console.error('請在 .env.local 設定 SUPABASE_DATABASE_URL。');
  process.exit(1);
}

const sql = readFileSync(join(root, 'supabase', 'conversation_inbox_actions.sql'), 'utf8');
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
await client.query(`revoke execute on function public.delete_conversation_as_participant(uuid) from anon`);
await client.query(`NOTIFY pgrst, 'reload schema'`);
console.log('conversation_inbox_actions.sql applied');
await client.end();
