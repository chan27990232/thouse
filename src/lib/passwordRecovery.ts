import { supabase } from './supabase';
import { invokeRequestPasswordReset } from './requestPasswordReset';

const RECOVERY_PENDING_KEY = 'thouse:password-recovery-pending';

function readUrlAuthParams(): URLSearchParams {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const merged = new URLSearchParams();
  for (const [key, value] of hash.entries()) merged.set(key, value);
  for (const [key, value] of search.entries()) merged.set(key, value);
  return merged;
}

/** 重設密碼 email 連結導回此 URL（須與 Supabase Redirect URLs 一致） */
export function getPasswordResetRedirectUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  const base = (configured || window.location.origin).replace(/\/$/, '');
  return `${base}/`;
}

export function hasAuthCallbackInUrl(): boolean {
  const params = readUrlAuthParams();
  return (
    params.has('code') ||
    params.has('access_token') ||
    params.has('token_hash') ||
    params.get('type') === 'recovery'
  );
}

export function isPasswordRecoveryCallback(): boolean {
  const params = readUrlAuthParams();
  return params.get('type') === 'recovery' || hasAuthCallbackInUrl();
}

export function getAuthCallbackError(): string | null {
  const params = readUrlAuthParams();
  const raw = params.get('error_description') || params.get('error');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

export function markPasswordRecoveryPending(): void {
  try {
    sessionStorage.setItem(RECOVERY_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearPasswordRecoveryPending(): void {
  try {
    sessionStorage.removeItem(RECOVERY_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function isPasswordRecoveryPending(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPasswordRecoveryUrl(): void {
  if (!window.location.hash && !window.location.search) return;
  window.history.replaceState({}, document.title, window.location.pathname || '/');
}

export function shouldShowPasswordRecoveryScreen(): boolean {
  return isPasswordRecoveryPending() || isPasswordRecoveryCallback();
}

/** App 啟動時呼叫：從 email 連結建立 recovery session */
export async function initAuthFromUrl(): Promise<boolean> {
  const callbackError = getAuthCallbackError();
  if (callbackError) {
    throw new Error(callbackError);
  }

  if (!hasAuthCallbackInUrl() && !isPasswordRecoveryPending()) {
    return false;
  }

  markPasswordRecoveryPending();

  const params = readUrlAuthParams();
  const code = params.get('code');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      clearPasswordRecoveryPending();
      throw error;
    }
    clearPasswordRecoveryUrl();
    return true;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) {
    clearPasswordRecoveryUrl();
    return true;
  }

  return isPasswordRecoveryPending();
}

export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  const { data, error } = await supabase.rpc('resolve_password_login_email', {
    p_login: trimmed,
  });
  if (error) throw error;
  return typeof data === 'string' && data.trim() ? data.trim().toLowerCase() : null;
}

/**
 * 透過 Resend 寄送（Edge Function request-password-reset）。
 * Supabase SMTP 若未正確設定會出現 "Error sending recovery email"，故不走 auth/v1/recover 寄信。
 */
export async function requestPasswordResetEmail(identifier: string): Promise<void> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error('請輸入你的電子郵件或用戶名稱。');
  }

  await invokeRequestPasswordReset({
    identifier: trimmed,
    redirectTo: getPasswordResetRedirectUrl(),
  });
}

if (typeof window !== 'undefined' && isPasswordRecoveryCallback()) {
  markPasswordRecoveryPending();
}
