import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { archiveDeactivatedAccount } from './archiveDeactivatedAccount';
import { sendEmail, smtpEnvFromProcess, type SmtpEnv } from './sendEmail';

export type SignupVerificationEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  smtp: SmtpEnv;
};

export type SignupVerificationBody = {
  action?: string;
  email?: string;
  code?: string;
  password?: string;
  fullName?: string;
  username?: string;
  role?: string;
};

export type SignupVerificationResult = {
  ok: boolean;
  message?: string;
  status?: number;
};

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function registerVerifiedAccount(
  supabase: SupabaseClient,
  input: {
    email: string;
    code: string;
    password: string;
    fullName: string;
    username: string;
    role: 'tenant' | 'landlord';
  },
): Promise<SignupVerificationResult> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();
  const password = input.password;
  const fullName = input.fullName.trim();
  const username = input.username.trim().toLowerCase();
  const role = input.role === 'landlord' ? 'landlord' : 'tenant';

  if (!code) return { ok: false, message: '請輸入驗證碼。', status: 400 };
  if (!fullName) return { ok: false, message: '請輸入名稱。', status: 400 };
  if (!username) return { ok: false, message: '請輸入登入帳號。', status: 400 };
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return {
      ok: false,
      message: '登入帳號須為 3–32 字，僅限英文小寫、數字、. _ -',
      status: 400,
    };
  }
  if (password.length < 6) return { ok: false, message: '密碼至少需要 6 個字元。', status: 400 };

  const { data: verified, error: verifyError } = await supabase.rpc('verify_signup_verification_code', {
    p_email: email,
    p_code: code,
  });
  if (verifyError) return { ok: false, message: verifyError.message, status: 500 };
  if (!verified) return { ok: false, message: '驗證碼不正確或已過期。', status: 400 };

  const { data: emailCheck, error: emailCheckError } = await supabase.rpc('validate_signup_email', {
    p_email: email,
  });
  if (emailCheckError) return { ok: false, message: emailCheckError.message, status: 500 };
  const emailPayload = emailCheck as { ok?: boolean; message?: string } | null;
  if (!emailPayload?.ok) {
    return { ok: false, message: emailPayload?.message || '電郵無法使用。', status: 400 };
  }

  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('id, is_deactivated, username')
    .eq('username', username)
    .maybeSingle();

  if (existingUsername?.id) {
    if (existingUsername.is_deactivated) {
      try {
        await archiveDeactivatedAccount(supabase, existingUsername.id, existingUsername.username || username);
      } catch (archiveError) {
        const message = archiveError instanceof Error ? archiveError.message : '釋放註銷帳號失敗';
        return { ok: false, message, status: 500 };
      }
    } else {
      return { ok: false, message: '此登入帳號已被使用，請改用另一個。', status: 400 };
    }
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, username },
  });
  if (createError) return { ok: false, message: createError.message, status: 400 };

  const userId = created.user?.id;
  if (!userId) return { ok: false, message: '建立帳戶失敗。', status: 500 };

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      username,
      salutation: '',
      phone: '',
      response_time: '',
      is_verified: false,
      role,
      is_deactivated: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (profileError) return { ok: false, message: profileError.message, status: 500 };

  return { ok: true, message: '註冊成功。' };
}

async function validateSignupEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('validate_signup_email', { p_email: email });
  if (error) {
    return { ok: false, message: error.message };
  }
  const payload = data as { ok?: boolean; message?: string } | null;
  if (!payload?.ok) {
    return { ok: false, message: payload?.message || '電郵格式不正確。' };
  }
  return { ok: true };
}

async function sendVerificationEmail(env: SignupVerificationEnv, email: string, code: string) {
  await sendEmail(env.smtp, {
    to: email,
    subject: '簡屋 · 註冊驗證碼',
    html: `
      <div style="font-family:sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">簡屋 · 註冊驗證碼</h2>
        <p>你的驗證碼是：</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:16px 0">${code}</p>
        <p style="color:#555;font-size:14px">驗證碼 10 分鐘內有效。如非本人操作，請忽略此電郵。</p>
      </div>
    `,
  });
}

async function sendOtpForEmail(
  supabase: SupabaseClient,
  env: SignupVerificationEnv,
  email: string,
  options: { requireNewSignup?: boolean },
): Promise<SignupVerificationResult> {
  if (options.requireNewSignup) {
    const check = await validateSignupEmail(supabase, email);
    if (!check.ok) {
      return { ok: false, message: check.message, status: 400 };
    }
  } else {
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!profile?.id) {
      return { ok: true, message: '若該電郵已註冊，驗證碼已寄出。' };
    }
  }

  const { data: recent } = await supabase
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
  const { error: storeError } = await supabase.rpc('store_signup_verification_code', {
    p_email: email,
    p_code: code,
    p_ttl_minutes: 10,
  });
  if (storeError) {
    return { ok: false, message: storeError.message, status: 500 };
  }

  await sendVerificationEmail(env, email, code);
  return { ok: true, message: '驗證碼已寄出。' };
}

export function signupVerificationEnvFromProcess(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): SignupVerificationEnv {
  return {
    supabaseUrl: (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
    serviceRoleKey: (env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    smtp: smtpEnvFromProcess(env),
  };
}

export async function handleSignupVerification(
  body: SignupVerificationBody,
  env: SignupVerificationEnv = signupVerificationEnvFromProcess(),
): Promise<SignupVerificationResult> {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return { ok: false, message: '伺服器設定不完整。', status: 500 };
  }

  const action = String(body.action ?? '');
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) {
    return { ok: false, message: '請輸入 email。', status: 400 };
  }

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey);

  try {
    if (action === 'send') {
      return sendOtpForEmail(supabase, env, email, { requireNewSignup: true });
    }

    if (action === 'send_existing') {
      return sendOtpForEmail(supabase, env, email, { requireNewSignup: false });
    }

    if (action === 'register') {
      const role = String(body.role ?? 'tenant') === 'landlord' ? 'landlord' : 'tenant';
      return registerVerifiedAccount(supabase, {
        email,
        code: String(body.code ?? ''),
        password: String(body.password ?? ''),
        fullName: String(body.fullName ?? ''),
        username: String(body.username ?? ''),
        role,
      });
    }

    if (action === 'confirm') {
      const code = String(body.code ?? '').trim();
      if (!code) return { ok: false, message: '請輸入驗證碼。', status: 400 };

      const { data: verified, error: verifyError } = await supabase.rpc('verify_signup_verification_code', {
        p_email: email,
        p_code: code,
      });
      if (verifyError) return { ok: false, message: verifyError.message, status: 500 };
      if (!verified) return { ok: false, message: '驗證碼不正確或已過期。', status: 400 };

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (profileError) return { ok: false, message: profileError.message, status: 500 };
      if (!profile?.id) return { ok: false, message: '找不到帳戶。', status: 404 };

      const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
        email_confirm: true,
      });
      if (updateError) return { ok: false, message: updateError.message, status: 400 };

      return { ok: true, message: '電郵已驗證。' };
    }

    return { ok: false, message: '不支援的操作。', status: 400 };
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return { ok: false, message, status: 500 };
  }
}
