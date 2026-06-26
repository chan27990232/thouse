import { createClient } from '@supabase/supabase-js';
import { archiveDeactivatedAccount } from './archiveDeactivatedAccount';
import { resendSignupOtpEmail } from './resendSignupOtp';

export type SignupAccountInput = {
  email: string;
  password: string;
  fullName: string;
  username: string;
  role: 'tenant' | 'landlord';
};

export type SignupAccountResult =
  | { ok: true; email: string; emailSent: boolean; emailWarning?: string }
  | { ok: false; message: string; status?: number };

export type ResendSignupOtpResult =
  | { ok: true; emailSent: true }
  | { ok: false; message: string; status?: number };

export async function handleResendSignupOtp(
  email: string,
  env: { supabaseUrl: string; serviceRoleKey: string },
): Promise<ResendSignupOtpResult> {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, message: '請輸入電子郵件。', status: 400 };
  }
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return { ok: false, message: '伺服器未設定 SUPABASE_SERVICE_ROLE_KEY。', status: 500 };
  }

  const result = await resendSignupOtpEmail(env.supabaseUrl, env.serviceRoleKey, normalizedEmail);
  if (!result.ok) {
    return { ok: false, message: result.message, status: 400 };
  }
  return { ok: true, emailSent: true };
}

export async function handleSignupAccount(
  input: SignupAccountInput,
  env: { supabaseUrl: string; serviceRoleKey: string },
): Promise<SignupAccountResult> {
  const email = String(input.email ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  const fullName = String(input.fullName ?? '').trim();
  const username = String(input.username ?? '').trim().toLowerCase();
  const role = input.role === 'landlord' ? 'landlord' : 'tenant';

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return { ok: false, message: '伺服器未設定 SUPABASE_SERVICE_ROLE_KEY。', status: 500 };
  }

  if (!email) {
    return { ok: false, message: '請輸入電子郵件。', status: 400 };
  }
  if (!username) {
    return { ok: false, message: '請輸入登入帳號。', status: 400 };
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return {
      ok: false,
      message: '登入帳號須為 3–32 字，僅限英文小寫、數字、. _ -',
      status: 400,
    };
  }
  if (!fullName) {
    return { ok: false, message: '請輸入名稱。', status: 400 };
  }
  if (password.length < 6) {
    return { ok: false, message: '密碼至少需要 6 個字元。', status: 400 };
  }

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: emailCheck, error: emailCheckError } = await supabase.rpc('validate_signup_email', {
    p_email: email,
  });
  if (emailCheckError) {
    return { ok: false, message: emailCheckError.message, status: 500 };
  }
  const emailPayload = emailCheck as { ok?: boolean; message?: string } | null;
  if (!emailPayload?.ok) {
    return {
      ok: false,
      message: emailPayload?.message || '電郵格式不正確或已被註冊。',
      status: 400,
    };
  }

  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('id, is_deactivated, username')
    .eq('username', username)
    .maybeSingle();

  if (existingUsername?.id) {
    if (existingUsername.is_deactivated) {
      try {
        await archiveDeactivatedAccount(
          supabase,
          existingUsername.id,
          existingUsername.username || username,
        );
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
    email_confirm: false,
    user_metadata: {
      full_name: fullName,
      role,
      username,
    },
  });

  if (createError) {
    return { ok: false, message: createError.message, status: 400 };
  }

  const userId = created.user?.id;
  if (!userId) {
    return { ok: false, message: '建立帳戶失敗。', status: 500 };
  }

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

  if (profileError) {
    return { ok: false, message: profileError.message, status: 500 };
  }

  return { ok: true, email, emailSent: false };
}
