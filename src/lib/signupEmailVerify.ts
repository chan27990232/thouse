import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { syncProfileForUser } from './profiles';
import type { UserRole } from '../App';
import { getRoleFromMetadata } from './auth';
import { registerWithEmailCode, sendSignupVerificationOtp } from './signupEmailOtp';

const AUTH_TIMEOUT_MS = 45_000;

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
  if (m.includes('error sending confirmation email') || m.includes('error sending recovery email')) {
    return '無法寄出郵件，請確認 Supabase SMTP 或已部署 signup-verification / request-password-reset 並設定 RESEND_API_KEY。';
  }
  if (m.includes('smtp')) {
    return '無法寄出郵件，請檢查 Supabase → Authentication → SMTP 設定。';
  }
  if (m.includes('redirect') || m.includes('invalid request') || m.includes('otp_expired') || m.includes('expired')) {
    return '重設密碼連結無效或已過期，請重新申請忘記密碼。';
  }
  if (m.includes('email address not authorized') || m.includes('signup is disabled')) {
    return '此電郵無法重設密碼，請確認帳戶已註冊。';
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

export type PendingSignupInput = {
  email: string;
  password: string;
  fullName: string;
  username: string;
  role: UserRole;
};

/** 驗證電郵成功後才建立帳戶並登入。 */
export async function completeSignupWithEmailVerification(input: PendingSignupInput, code: string) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const signupRole = input.role === 'landlord' ? 'landlord' : 'tenant';

  await registerWithEmailCode({
    email: normalizedEmail,
    code: code.trim(),
    password: input.password,
    fullName: input.fullName.trim(),
    username: input.username.trim().toLowerCase(),
    role: signupRole,
  });

  const { data, error } = await withAuthTimeout(
    supabase.auth.getSession(),
    '登入逾時，請稍後再試。',
  );
  if (error || !data.session?.user) {
    throw new Error(formatAuthFailure(error, '註冊成功但登入失敗，請手動登入。'));
  }

  const verifiedRole = getRoleFromMetadata(data.session.user.user_metadata) ?? signupRole;
  await syncProfileForUser(data.session.user, verifiedRole);
  return { session: data.session, role: verifiedRole };
}

/** @deprecated 請改用 completeSignupWithEmailVerification */
export async function verifySignupEmailOtp(email: string, token: string, password?: string) {
  if (!password) {
    throw new Error('驗證碼不正確或已過期。');
  }
  return completeSignupWithEmailVerification(
    {
      email,
      password,
      fullName: '',
      username: email.split('@')[0] || 'user',
      role: 'tenant',
    },
    token,
  );
}

export async function resendSignupVerification(email: string) {
  await sendSignupVerificationOtp(email);
}
