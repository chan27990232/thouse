import { supabase } from './supabase';
import { findEmailByUsername } from './profiles';

type RegisterResponse = { ok: boolean; message?: string; email?: string };

function translateRegisterError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('email rate limit exceeded')) {
    return '註冊請求過於頻繁，請稍後再試。';
  }
  if (m.includes('supabase_service_role_key')) {
    return '伺服器未設定註冊服務（SUPABASE_SERVICE_ROLE_KEY）。';
  }
  return message;
}

async function callRegisterApi(input: {
  username: string;
  password: string;
  fullName: string;
}): Promise<RegisterResponse> {
  const res = await fetch('/api/register-tenant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: input.username.trim().toLowerCase(),
      password: input.password,
      fullName: input.fullName.trim(),
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as RegisterResponse;
  if (!res.ok || !payload.ok) {
    throw new Error(translateRegisterError(payload.message || `註冊失敗（${res.status}）`));
  }
  return payload;
}

export async function registerTenantAccount(input: {
  username: string;
  password: string;
  fullName: string;
}): Promise<void> {
  const username = input.username.trim().toLowerCase();
  const existing = await findEmailByUsername(username).catch(() => null);
  if (existing) {
    throw new Error('此登入帳號已被使用，請改用另一個。');
  }

  const payload = await callRegisterApi(input);
  const loginEmail = payload.email ?? (await findEmailByUsername(username));
  if (!loginEmail) {
    throw new Error('帳戶已建立但無法解析登入資料，請聯絡客服。');
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: input.password,
  });

  if (signInError) {
    throw new Error(`帳戶已建立但自動登入失敗：${translateRegisterError(signInError.message)}`);
  }
}
