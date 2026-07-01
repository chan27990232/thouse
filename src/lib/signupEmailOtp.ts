import { supabase } from './supabase';
import { validateSignupEmailWithDatabase } from './signupEmailValidation';

type FnResponse = { ok: boolean; message?: string };

async function invokeSignupVerification(body: Record<string, unknown>): Promise<FnResponse> {
  const { data, error } = await supabase.functions.invoke('signup-verification', { body });

  if (error) {
    const hint =
      error.message?.includes('Failed to send a request to the Edge Function') ||
      error.message?.includes('FunctionsRelayError')
        ? '驗證碼郵件服務尚未部署。請部署 signup-verification 並在 Supabase 設定 RESEND_API_KEY。'
        : error.message;
    throw new Error(hint);
  }

  const payload = (data ?? {}) as FnResponse;
  if (!payload.ok) {
    throw new Error(payload.message || '操作失敗');
  }
  return payload;
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

export async function registerTenantWithEmailCode(input: {
  email: string;
  code: string;
  password: string;
  fullName: string;
}): Promise<void> {
  await invokeSignupVerification({
    action: 'register',
    email: input.email.trim().toLowerCase(),
    code: input.code.trim(),
    password: input.password,
    fullName: input.fullName.trim(),
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    throw new Error(`帳戶已建立但自動登入失敗：${error.message}`);
  }
}
