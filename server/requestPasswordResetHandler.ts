import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, smtpEnvFromProcess, type SmtpEnv } from './sendEmail';

export type RequestPasswordResetEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  smtp: SmtpEnv;
  publicAppUrl: string;
};

export type RequestPasswordResetBody = {
  identifier?: string;
  email?: string;
  redirectTo?: string;
};

export type RequestPasswordResetResult = {
  ok: boolean;
  message?: string;
  status?: number;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function resolveAuthEmail(
  supabase: SupabaseClient,
  identifier: string,
): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  const { data, error } = await supabase.rpc('resolve_password_login_email', {
    p_login: trimmed,
  });
  if (error) throw error;
  return typeof data === 'string' && data.trim() ? data.trim().toLowerCase() : null;
}

async function sendRecoveryEmail(env: RequestPasswordResetEnv, to: string, actionLink: string) {
  await sendEmail(env.smtp, {
    to,
    subject: '簡屋 · 重設密碼',
    html: `
      <div style="font-family:sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">簡屋 · 重設密碼</h2>
        <p>你好，</p>
        <p>請點擊以下連結重設你的密碼：</p>
        <p style="margin:16px 0">
          <a href="${escapeHtml(actionLink)}" style="color:#1a365d;font-weight:600">重設密碼</a>
        </p>
        <p style="color:#555;font-size:14px">連結僅限短時間內有效。如非本人操作，請忽略此電郵。</p>
      </div>
    `,
  });
}

function isUserNotFoundError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('user not found') ||
    m.includes('not found') ||
    m.includes('no user') ||
    m.includes('invalid email')
  );
}

export function requestPasswordResetEnvFromProcess(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): RequestPasswordResetEnv {
  return {
    supabaseUrl: (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
    serviceRoleKey: (env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    smtp: smtpEnvFromProcess(env),
    publicAppUrl: (env.PUBLIC_APP_URL || env.VITE_PUBLIC_APP_URL || 'https://thousehk.com').trim(),
  };
}

export async function handleRequestPasswordReset(
  body: RequestPasswordResetBody,
  env: RequestPasswordResetEnv = requestPasswordResetEnvFromProcess(),
): Promise<RequestPasswordResetResult> {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return { ok: false, message: '伺服器設定不完整。', status: 500 };
  }

  const identifier = String(body.identifier ?? body.email ?? '').trim();
  const redirectTo =
    String(body.redirectTo ?? '').trim() ||
    env.publicAppUrl.replace(/\/$/, '') + '/';

  if (!identifier) {
    return { ok: false, message: '請輸入電子郵件或用戶名稱。', status: 400 };
  }

  try {
    const supabase = createClient(env.supabaseUrl, env.serviceRoleKey);
    const email = await resolveAuthEmail(supabase, identifier);

    if (!email) {
      return {
        ok: true,
        message: '若該帳戶存在，重設密碼連結已寄至註冊電郵。',
      };
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: redirectTo.replace(/\/$/, '') + '/',
      },
    });

    if (error) {
      if (isUserNotFoundError(error.message)) {
        return {
          ok: true,
          message: '若該帳戶存在，重設密碼連結已寄至註冊電郵。',
        };
      }
      return { ok: false, message: error.message, status: 400 };
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink || typeof actionLink !== 'string') {
      return { ok: false, message: '無法產生重設密碼連結。', status: 500 };
    }

    await sendRecoveryEmail(env, email, actionLink);

    return {
      ok: true,
      message: '重設密碼連結已寄出，請到註冊電郵收件匣查看。',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return { ok: false, message, status: 500 };
  }
}
