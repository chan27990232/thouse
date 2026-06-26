import type { AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { syncProfileForUser } from './profiles';
import type { UserRole } from '../App';
import { getRoleFromMetadata } from './auth';

const AUTH_TIMEOUT_MS = 45_000;
const SIGNUP_API_TIMEOUT_MS = 30_000;

export const SIGNUP_RESEND_COOLDOWN_SEC = 60;

export function isSignupEmailRateLimited(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('寄信過於頻繁') ||
    m.includes('over_email_send_rate_limit') ||
    m.includes('email rate limit') ||
    m.includes('rate limit')
  );
}

function translateAuthMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed')) {
    return '請先完成電郵驗證，再登入。';
  }
  if (m.includes('invalid login credentials')) {
    return '登入資料不正確，請檢查後再試。';
  }
  if (isSignupEmailRateLimited(m)) {
    return `寄信過於頻繁，請約 ${SIGNUP_RESEND_COOLDOWN_SEC} 秒後再按「重新寄送驗證碼」。`;
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return '此電郵已被註冊，請直接登入或使用其他電郵。';
  }
  if (m.includes('error sending confirmation email') || m.includes('smtp')) {
    return '無法寄出驗證碼，請檢查 Supabase 寄信設定（SMTP）後再試。';
  }
  return message;
}

export function formatAuthFailure(error: unknown, fallback: string): string {
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (trimmed && trimmed !== '{}') {
      return translateAuthMessage(trimmed);
    }
    return fallback;
  }

  if (error && typeof error === 'object') {
    const authError = error as AuthError & { msg?: string; error_description?: string };
    const candidates = [authError.message, authError.msg, authError.error_description, authError.code]
      .filter((part): part is string => typeof part === 'string')
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && part !== '{}');

    if (candidates.length > 0) {
      return translateAuthMessage(candidates[0]!);
    }
  }

  return fallback;
}

export function withAuthTimeout<T>(promise: PromiseLike<T>, message: string): Promise<T> {
  return withAuthTimeoutMs(promise, message, AUTH_TIMEOUT_MS);
}

export function withAuthTimeoutMs<T>(promise: PromiseLike<T>, message: string, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

type SignupAccountResponse = {
  ok: boolean;
  message?: string;
  email?: string;
  emailSent?: boolean;
  emailWarning?: string;
};

function getSupabasePublicConfig() {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
  return { supabaseUrl, anonKey };
}

async function invokeSignupAccountFunction(
  body: Record<string, unknown>,
): Promise<SignupAccountResponse> {
  const { supabaseUrl, anonKey } = getSupabasePublicConfig();
  if (!supabaseUrl || !anonKey) {
    throw new Error('應用程式尚未設定 Supabase，無法註冊。');
  }

  const res = await withAuthTimeoutMs(
    fetch(`${supabaseUrl}/functions/v1/signup-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    }),
    '註冊請求逾時，請稍後再試。',
    SIGNUP_API_TIMEOUT_MS,
  );

  const payload = (await res.json().catch(() => ({}))) as SignupAccountResponse;
  if (!res.ok || !payload.ok) {
    throw new Error(payload.message || `註冊失敗（${res.status}）`);
  }
  return payload;
}

async function callSignupAccountApi(
  body: Record<string, unknown>,
): Promise<SignupAccountResponse> {
  if (isSupabaseConfigured) {
    return invokeSignupAccountFunction(body);
  }

  if (import.meta.env.PROD) {
    throw new Error('註冊服務暫時無法使用，請稍後再試或聯絡客服。');
  }

  const res = await withAuthTimeoutMs(
    fetch('/api/signup-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    '註冊請求逾時，請稍後再試。',
    SIGNUP_API_TIMEOUT_MS,
  );

  const payload = (await res.json().catch(() => ({}))) as SignupAccountResponse;
  if (!res.ok || !payload.ok) {
    throw new Error(payload.message || `註冊失敗（${res.status}）`);
  }
  return payload;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  fullName: string;
  username: string;
  role: UserRole;
}): Promise<{ emailSent: false }> {
  await callSignupAccountApi({
    action: 'create',
    email: input.email.trim().toLowerCase(),
    password: input.password,
    fullName: input.fullName.trim(),
    username: input.username.trim().toLowerCase(),
    role: input.role ?? 'tenant',
  });

  return { emailSent: false };
}

export async function verifySignupEmailOtp(email: string, token: string) {
  const trimmed = token.trim();
  const tryTypes = ['signup', 'email'] as const;

  let lastError: Error | null = null;
  for (const type of tryTypes) {
    const { data, error } = await withAuthTimeout(
      supabase.auth.verifyOtp({ email, token: trimmed, type }),
      '驗證逾時，請稍後再試。',
    );
    if (!error && data.session) {
      const role = getRoleFromMetadata(data.user?.user_metadata) ?? 'tenant';
      if (data.user) {
        await syncProfileForUser(data.user, role);
      }
      return { session: data.session, role };
    }
    if (error) {
      lastError = error;
    }
  }

  throw new Error(formatAuthFailure(lastError, '驗證碼不正確或已過期。'));
}

export async function resendSignupVerification(email: string) {
  const payload = await callSignupAccountApi({
    action: 'resend',
    email: email.trim().toLowerCase(),
  });

  if (payload.emailSent === false) {
    throw new Error(
      formatAuthFailure(
        payload.emailWarning,
        '無法重發驗證碼，請檢查 Supabase SMTP 設定後再試。',
      ),
    );
  }
}
