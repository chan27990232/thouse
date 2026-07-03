import nodemailer from 'nodemailer';

export type SmtpEnv = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
};

const DEFAULT_FROM = 'T-House Limited <noreply@thousehk.com>';

export function smtpEnvFromProcess(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): SmtpEnv {
  const from =
    (env.SMTP_FROM || env.RESEND_FROM_EMAIL || env.LEASE_REJECTION_FROM_EMAIL || '').trim() ||
    DEFAULT_FROM;

  return {
    host: (env.SMTP_HOST || 'smtp.office365.com').trim(),
    port: Number(env.SMTP_PORT || '587'),
    user: (env.SMTP_USER || '').trim(),
    pass: (env.SMTP_PASS || '').trim(),
    from,
  };
}

export function assertSmtpConfigured(env: SmtpEnv): void {
  if (!env.user || !env.pass) {
    throw new Error('郵件服務未設定（請在 Vercel / .env.local 設定 SMTP_USER、SMTP_PASS）。');
  }
}

export async function sendEmail(env: SmtpEnv, input: SendEmailInput): Promise<void> {
  assertSmtpConfigured(env);

  const transport = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465,
    requireTLS: env.port === 587,
    auth: {
      user: env.user,
      pass: env.pass,
    },
  });

  try {
    await transport.sendMail({
      from: input.from || env.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知錯誤';
    if (/invalid login|authentication|auth/i.test(detail)) {
      throw new Error('郵件登入失敗，請檢查 SMTP_USER / SMTP_PASS（Office 365 需啟用 SMTP AUTH 或使用應用程式密碼）。');
    }
    throw new Error(`無法寄出郵件：${detail.slice(0, 200)}`);
  } finally {
    transport.close();
  }
}
