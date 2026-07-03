/**
 * 在 Windows 上部署 Supabase Edge Function（不需最新版 supabase CLI 二進位）。
 *
 * 1) 到 https://supabase.com/dashboard/account/tokens 建立 Personal Access Token
 * 2) 在 .env.local 設定：
 *      SUPABASE_ACCESS_TOKEN=sbp_...
 *      VITE_SUPABASE_URL=https://<ref>.supabase.co
 * 3) 執行：
 *      node scripts/deploy-edge-function.mjs notify-lease-rejection
 *      npm run deploy:notify-lease-rejection
 *
 * 可選：加上 --sync-secrets 會把 .env.local 內相關 secret 寫入專案。
 */
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

const FUNCTION_VERIFY_JWT = {
  'notify-lease-rejection': false,
  'signup-verification': false,
  'request-password-reset': false,
  'signup-account': false,
  'register-tenant': false,
};

const FUNCTION_SECRETS = {
  'notify-lease-rejection': [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'LEASE_REJECTION_FROM_EMAIL',
    'LEASE_REJECTION_NOTIFY_SECRET',
    'PUBLIC_APP_URL',
  ],
  'signup-verification': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
  'request-password-reset': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'PUBLIC_APP_URL'],
};

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

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const syncSecrets = process.argv.includes('--sync-secrets');
const slug = args[0];

if (!slug) {
  console.error('用法：node scripts/deploy-edge-function.mjs <function-slug> [--sync-secrets]');
  console.error('例：node scripts/deploy-edge-function.mjs notify-lease-rejection --sync-secrets');
  process.exit(1);
}

const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const projectRef =
  (process.env.SUPABASE_PROJECT_REF || '').trim() || projectRefFromUrl(supabaseUrl);

if (!token) {
  console.error('缺少 SUPABASE_ACCESS_TOKEN。');
  console.error('請到 https://supabase.com/dashboard/account/tokens 建立 token，寫入 .env.local');
  process.exit(1);
}

if (!projectRef) {
  console.error('無法解析專案 ref，請設定 VITE_SUPABASE_URL 或 SUPABASE_PROJECT_REF。');
  process.exit(1);
}

const indexPath = join(root, 'supabase', 'functions', slug, 'index.ts');
if (!existsSync(indexPath)) {
  console.error('找不到函式原始碼：', indexPath);
  process.exit(1);
}

const source = readFileSync(indexPath, 'utf8');
const metadata = {
  entrypoint_path: 'index.ts',
  name: slug,
  verify_jwt: FUNCTION_VERIFY_JWT[slug] ?? true,
};

const form = new FormData();
form.append('metadata', JSON.stringify(metadata));
form.append('file', new Blob([source], { type: 'text/typescript' }), 'index.ts');

const deployUrl = `https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(slug)}`;
console.log(`部署 ${slug} → ${projectRef} …`);

const deployRes = await fetch(deployUrl, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});

const deployText = await deployRes.text();
let deployJson;
try {
  deployJson = JSON.parse(deployText);
} catch {
  deployJson = { raw: deployText };
}

if (!deployRes.ok) {
  console.error('部署失敗（', deployRes.status, '）：', deployJson.message || deployText.slice(0, 500));
  process.exit(1);
}

console.log('✓ 已部署', slug, `(status: ${deployJson.status ?? deployRes.status})`);

if (syncSecrets) {
  const secretNames = FUNCTION_SECRETS[slug] ?? [];
  const payload = secretNames
    .map((name) => ({ name, value: (process.env[name] || '').trim() }))
    .filter((row) => row.value.length > 0);

  if (payload.length === 0) {
    console.warn('略過 sync secrets：.env.local 沒有對應變數。');
  } else {
    const secretsRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!secretsRes.ok) {
      const errText = await secretsRes.text();
      console.warn('Secrets 同步失敗（', secretsRes.status, '）：', errText.slice(0, 300));
      console.warn('請手動在 Dashboard → Edge Functions → Secrets 設定。');
    } else {
      console.log('✓ 已同步 secrets：', payload.map((p) => p.name).join(', '));
    }
  }
}

console.log(`測試：${supabaseUrl.replace(/\/$/, '')}/functions/v1/${slug}`);
