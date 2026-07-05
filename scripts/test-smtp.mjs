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

const to = process.argv[2] || process.env.SMTP_USER;
if (!to) {
  console.error('用法：node scripts/test-smtp.mjs [收件 email]');
  process.exit(1);
}

const { sendEmail, smtpEnvFromProcess } = await import('../server/sendEmail.ts');
import nodemailer from 'nodemailer';

const smtp = smtpEnvFromProcess();
console.log(`SMTP_USER=${smtp.user}`);
console.log(`SMTP_HOST=${smtp.host}:${smtp.port}`);
console.log(`SMTP_FROM=${smtp.from}`);

try {
  await sendEmail(smtp, {
    to,
    subject: '簡屋 · SMTP 測試',
    html: '<p>若你收到此信，Office 365 SMTP 設定正確。</p>',
  });
  console.log(`✓ 已寄出測試信至 ${to}`);
} catch (error) {
  console.error('✗ 寄信失敗：', error instanceof Error ? error.message : error);
  try {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port === 587,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transport.verify();
  } catch (detail) {
    if (detail && typeof detail === 'object') {
      if ('code' in detail && detail.code) console.error('  code:', detail.code);
      if ('responseCode' in detail && detail.responseCode) console.error('  responseCode:', detail.responseCode);
      if ('response' in detail && detail.response) console.error('  response:', detail.response);
    }
  }
  process.exit(1);
}
