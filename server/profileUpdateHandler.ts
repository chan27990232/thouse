import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { sendEmail, smtpEnvFromProcess, type SmtpEnv } from './sendEmail.js';

export type ProfileUpdateEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  smtp: SmtpEnv;
};

export type ProfileUpdateBody = {
  action?: string;
  newEmail?: string;
  salutation?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  emailCode?: string;
};

export type ProfileUpdateResult = {
  ok: boolean;
  message?: string;
  status?: number;
};

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getUserFromAuthorization(
  env: ProfileUpdateEnv,
  authorizationHeader?: string | null,
): Promise<{ user: User; admin: SupabaseClient } | ProfileUpdateResult> {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, message: '請先登入。', status: 401 };
  }

  const userClient = createClient(env.supabaseUrl, env.anonKey);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, message: '登入已失效，請重新登入。', status: 401 };
  }

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey);
  return { user: data.user, admin };
}

async function sendEmailChangeOtp(
  admin: SupabaseClient,
  env: ProfileUpdateEnv,
  newEmail: string,
): Promise<ProfileUpdateResult> {
  const email = normalizeEmail(newEmail);
  const check = await admin.rpc('validate_signup_email', { p_email: email });
  if (check.error) return { ok: false, message: check.error.message, status: 500 };
  const payload = check.data as { ok?: boolean; message?: string } | null;
  if (!payload?.ok) {
    return { ok: false, message: payload?.message || '電郵無法使用。', status: 400 };
  }

  const { data: recent } = await admin
    .from('signup_email_verification_codes')
    .select('created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.created_at) {
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < 60_000) {
      return { ok: false, message: '請稍候再重新發送驗證碼。', status: 429 };
    }
  }

  const code = generateCode();
  const { error: storeError } = await admin.rpc('store_signup_verification_code', {
    p_email: email,
    p_code: code,
    p_ttl_minutes: 10,
  });
  if (storeError) return { ok: false, message: storeError.message, status: 500 };

  await sendEmail(env.smtp, {
    to: email,
    subject: '簡屋 · 更改電郵驗證碼',
    html: `
      <div style="font-family:sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">簡屋 · 更改電郵驗證碼</h2>
        <p>你的驗證碼是：</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:16px 0">${code}</p>
        <p style="color:#555;font-size:14px">驗證碼 10 分鐘內有效。如非本人操作，請忽略此電郵。</p>
      </div>
    `,
  });

  return { ok: true, message: '驗證碼已寄出。' };
}

function normalizeSalutation(value: unknown): string {
  if (value === '先生' || value === '女士' || value === '不便透露') return value;
  return '';
}

async function updateOwnProfile(
  user: User,
  admin: SupabaseClient,
  body: ProfileUpdateBody,
): Promise<ProfileUpdateResult> {
  const salutation = normalizeSalutation(body.salutation);
  const fullName = String(body.fullName ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const nextEmail = normalizeEmail(String(body.email ?? user.email ?? ''));
  const currentEmail = normalizeEmail(user.email ?? '');

  if (!fullName) {
    return { ok: false, message: '請輸入姓名。', status: 400 };
  }

  const emailChanged = nextEmail !== currentEmail;
  if (emailChanged) {
    if (!nextEmail) return { ok: false, message: '請輸入電郵。', status: 400 };
    const code = String(body.emailCode ?? '').trim();
    if (!code) return { ok: false, message: '更改電郵須先輸入驗證碼。', status: 400 };

    const emailCheck = await admin.rpc('validate_signup_email', { p_email: nextEmail });
    if (emailCheck.error) return { ok: false, message: emailCheck.error.message, status: 500 };
    const emailPayload = emailCheck.data as { ok?: boolean; message?: string } | null;
    if (!emailPayload?.ok) {
      return { ok: false, message: emailPayload?.message || '電郵無法使用。', status: 400 };
    }

    const { data: verified, error: verifyError } = await admin.rpc('verify_signup_verification_code', {
      p_email: nextEmail,
      p_code: code,
    });
    if (verifyError) return { ok: false, message: verifyError.message, status: 500 };
    if (!verified) return { ok: false, message: '驗證碼不正確或已過期。', status: 400 };

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
      email: nextEmail,
      email_confirm: true,
    });
    if (authUpdateError) return { ok: false, message: authUpdateError.message, status: 400 };
  }

  const { error: profileUpdateError } = await admin
    .from('profiles')
    .update({
      salutation,
      full_name: fullName,
      phone,
      ...(emailChanged ? { email: nextEmail } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileUpdateError) {
    const msg = (profileUpdateError.message || '').toLowerCase();
    if (msg.includes('display_name_change_limit')) {
      return { ok: false, message: '用戶名稱每 14 天最多只能修改 2 次，請稍後再試。', status: 400 };
    }
    return { ok: false, message: profileUpdateError.message, status: 500 };
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(typeof user.user_metadata === 'object' && user.user_metadata ? user.user_metadata : {}),
      salutation,
      full_name: fullName,
      phone,
    },
  });
  if (metadataError) return { ok: false, message: metadataError.message, status: 500 };

  return { ok: true, message: '個人資料已更新。' };
}

export async function handleProfileUpdate(
  body: ProfileUpdateBody,
  env: ProfileUpdateEnv,
  authorizationHeader?: string | null,
): Promise<ProfileUpdateResult> {
  const authResult = await getUserFromAuthorization(env, authorizationHeader);
  if ('ok' in authResult && authResult.ok === false) return authResult;
  if (!('user' in authResult)) return { ok: false, message: '請先登入。', status: 401 };

  const { user, admin } = authResult;
  const action = String(body.action ?? 'update');

  if (action === 'send_email_otp') {
    const newEmail = String(body.newEmail ?? body.email ?? '').trim();
    if (!newEmail) return { ok: false, message: '請輸入新電郵。', status: 400 };
    if (normalizeEmail(newEmail) === normalizeEmail(user.email ?? '')) {
      return { ok: false, message: '新電郵與目前電郵相同。', status: 400 };
    }
    return sendEmailChangeOtp(admin, env, newEmail);
  }

  if (action === 'update') {
    return updateOwnProfile(user, admin, body);
  }

  return { ok: false, message: '不支援的操作。', status: 400 };
}

export function profileUpdateEnvFromProcess(env: Record<string, string>): ProfileUpdateEnv | null {
  const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;
  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    smtp: smtpEnvFromProcess(env),
  };
}
