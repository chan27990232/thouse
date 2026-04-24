import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

if (!ref || !password) {
  console.error('需要 VITE_SUPABASE_URL 與 SUPABASE_DB_PASSWORD（見 .env.example）。');
  process.exit(1);
}

const host = process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;

const client = new Client({
  host,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  const profilesSql = await readFile(resolve('supabase/profiles.sql'), 'utf8');
  const propertiesSql = await readFile(resolve('supabase/properties.sql'), 'utf8');

  await client.connect();

  try {
    await client.query(profilesSql);
    await client.query(propertiesSql);

    const { rows } = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('profiles', 'properties')
        order by table_name
      `
    );

    console.log(JSON.stringify({ status: 'ok', tables: rows.map((row) => row.table_name) }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
