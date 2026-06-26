import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/delete-user-by-email.mjs user@example.com');
  process.exit(1);
}

const cs = (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim();
const client = new pg.Client(
  cs
    ? { connectionString: cs, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.SUPABASE_DB_HOST,
        port: Number(process.env.SUPABASE_DB_PORT || 5432),
        database: process.env.SUPABASE_DB_NAME || 'postgres',
        user: process.env.SUPABASE_DB_USER || 'postgres',
        password: process.env.SUPABASE_DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
      },
);

await client.connect();

const { rows: profiles } = await client.query(
  `select id, email, username, full_name, role
   from public.profiles
   where lower(email) = $1`,
  [email],
);

const { rows: authRows } = await client.query(
  `select id, email, created_at::text
   from auth.users
   where lower(email) = $1`,
  [email],
);

console.log('Email:', email);
console.log('profiles:', profiles);
console.log('auth.users:', authRows);

const ids = [...new Set([...profiles.map((r) => r.id), ...authRows.map((r) => r.id)])];
if (!ids.length) {
  console.log('No user found.');
  await client.end();
  process.exit(0);
}

for (const id of ids) {
  const { rowCount } = await client.query('delete from auth.users where id = $1', [id]);
  console.log(`Deleted auth.users ${id}:`, rowCount ? 'ok' : 'not found');
}

const { rows: left } = await client.query(
  `select id, email from public.profiles where lower(email) = $1`,
  [email],
);
console.log(left.length ? `Remaining profiles: ${JSON.stringify(left)}` : 'Profiles cleared (cascade).');
await client.end();
