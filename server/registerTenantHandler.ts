import { createClient } from '@supabase/supabase-js';
import { archiveDeactivatedAccount } from './archiveDeactivatedAccount.js';

export type RegisterTenantInput = {
  username: string;
  password: string;
  fullName: string;
};

export type RegisterTenantResult =
  | { ok: true; email: string }
  | { ok: false; message: string; status?: number };

function internalEmail(username: string) {
  return `${username.trim().toLowerCase()}@thouse.local`;
}

export async function handleRegisterTenant(
  input: RegisterTenantInput,
  env: { supabaseUrl: string; serviceRoleKey: string },
): Promise<RegisterTenantResult> {
  const username = String(input.username ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  const fullName = String(input.fullName ?? '').trim();

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return { ok: false, message: '伺服器未設定 SUPABASE_SERVICE_ROLE_KEY。', status: 500 };
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

  const email = internalEmail(username);

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, is_deactivated, username')
    .eq('username', username)
    .maybeSingle();

  if (existing?.id) {
    if (existing.is_deactivated) {
      try {
        await archiveDeactivatedAccount(supabase, existing.id, existing.username || username);
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
    user_metadata: {
      full_name: fullName,
      role: 'tenant',
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
      role: 'tenant',
      is_deactivated: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    return { ok: false, message: profileError.message, status: 500 };
  }

  return { ok: true, email };
}
