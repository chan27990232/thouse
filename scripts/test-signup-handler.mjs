import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
}

const email = process.argv[2] || 'chan27990232@gmail.com';
const { handleSignupVerification, signupVerificationEnvFromProcess } = await import(
  '../server/signupVerificationHandler.ts'
);
const result = await handleSignupVerification(
  { action: 'send', email },
  signupVerificationEnvFromProcess(),
);
console.log(JSON.stringify(result, null, 2));
