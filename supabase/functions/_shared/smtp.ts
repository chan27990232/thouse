import nodemailer from 'npm:nodemailer@6.9.16';

export type SmtpEnv = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

const DEFAULT_FROM = 'T-House Limited <noreply@thousehk.com>';

export function smtpEnvFromDeno(): SmtpEnv {
  const from =
    (Deno.env.get('SMTP_FROM') ||
      Deno.env.get('RESEND_FROM_EMAIL') ||
      Deno.env.get('LEASE_REJECTION_FROM_EMAIL') ||
      '').trim() || DEFAULT_FROM;

  return {
    host: (Deno.env.get('SMTP_HOST') || 'smtp.office365.com').trim(),
    port: Number(Deno.env.get('SMTP_PORT') || '587'),
    user: (Deno.env.get('SMTP_USER') || '').trim(),
    pass: (Deno.env.get('SMTP_PASS') || '').trim(),
    from,
  };
}

export function assertSmtpConfigured(env: SmtpEnv): void {
  if (!env.user || !env.pass) {
    throw new Error('郵件服務未設定（請在 Supabase 設定 SMTP_USER、SMTP_PASS）。');
  }
}

export async function sendEmail(
  env: SmtpEnv,
  input: { to: string | string[]; subject: string; html: string; from?: string },
): Promise<void> {
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
    throw new Error(`無法寄出郵件：${detail.slice(0, 200)}`);
  } finally {
    transport.close();
  }
}
