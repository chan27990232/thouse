import { supabase } from './supabase';
import { validateSignupEmailWithDatabase } from './signupEmailValidation';
import { withAuthTimeoutMs } from './signupEmailVerify';

type FnResponse = { ok: boolean; message?: string };

const SIGNUP_VERIFY_API_TIMEOUT_MS = 30_000;

async function invokeSignupVerificationApi(body: Record<string, unknown>): Promise<FnResponse> {
  let res: Response;
  try {
    res = await withAuthTimeoutMs(
      fetch('/api/signup-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      '驗證碼請求逾時，請稍後再試。',
      SIGNUP_VERIFY_API_TIMEOUT_MS,
    );
  } catch (error) {
    const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (/failed to fetch|fetch failed|networkerror|load failed/i.test(raw)) {
      throw new Error(
        '無法連線本機驗證碼服務。請改開 http://127.0.0.1:3000 並硬重新整理，確認終端機仍在執行 npm run dev。',
      );
    }
    throw error;
  }

  const payload = (await res.json().catch(() => ({}))) as FnResponse;
  if (!res.ok || !payload.ok) {
    throw new Error(payload.message || `驗證碼服務失敗（${res.status}）`);
  }
  return payload;
}

async function invokeSignupVerification(body: Record<string, unknown>): Promise<FnResponse> {
  return invokeSignupVerificationApi(body);
}

export async function sendSignupVerificationOtp(
  email: string,
  options?: { forExistingAccount?: boolean },
): Promise<void> {
  if (!options?.forExistingAccount) {
    const check = await validateSignupEmailWithDatabase(email);
    if (!check.ok) {
      throw new Error(check.message);
    }
  }

  await invokeSignupVerification({
    action: options?.forExistingAccount ? 'send_existing' : 'send',
    email: email.trim().toLowerCase(),
  });
}

export async function confirmSignupVerificationOtp(email: string, code: string): Promise<void> {
  await invokeSignupVerification({
    action: 'confirm',
    email: email.trim().toLowerCase(),
    code: code.trim(),
  });
}

/** @deprecated 請改用 sendSignupVerificationOtp */
export async function sendSignupEmailOtp(email: string): Promise<void> {
  await sendSignupVerificationOtp(email);
}

export async function registerWithEmailCode(input: {
  email: string;
  code: string;
  password: string;
  fullName: string;
  username: string;
  role: 'tenant' | 'landlord';
}): Promise<void> {
  await invokeSignupVerification({
    action: 'register',
    email: input.email.trim().toLowerCase(),
    code: input.code.trim(),
    password: input.password,
    fullName: input.fullName.trim(),
    username: input.username.trim().toLowerCase(),
    role: input.role,
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    throw new Error(`帳戶已建立但自動登入失敗：${error.message}`);
  }
}

/** @deprecated 請改用 registerWithEmailCode */
export async function registerTenantWithEmailCode(input: {
  email: string;
  code: string;
  password: string;
  fullName: string;
}): Promise<void> {
  await registerWithEmailCode({
    ...input,
    username: input.email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || `user${Date.now()}`,
    role: 'tenant',
  });
}
