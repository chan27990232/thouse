import { supabase, isSupabaseConfigured } from './supabase';
import { withAuthTimeoutMs } from './signupEmailVerify';

const RESET_API_TIMEOUT_MS = 30_000;

type ResetPasswordResponse = {
  ok: boolean;
  message?: string;
};

function getSupabasePublicConfig() {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
  return { supabaseUrl, anonKey };
}

export async function invokeRequestPasswordReset(body: {
  identifier: string;
  redirectTo: string;
}): Promise<ResetPasswordResponse> {
  const { supabaseUrl, anonKey } = getSupabasePublicConfig();

  if (isSupabaseConfigured && supabaseUrl && anonKey) {
    const res = await withAuthTimeoutMs(
      fetch(`${supabaseUrl}/functions/v1/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
      }),
      '寄送重設密碼信逾時，請稍後再試。',
      RESET_API_TIMEOUT_MS,
    );
    const payload = (await res.json().catch(() => ({}))) as ResetPasswordResponse;
    if (!res.ok || !payload.ok) {
      throw new Error(payload.message || `無法寄出重設密碼 email（${res.status}）`);
    }
    return payload;
  }

  if (import.meta.env.PROD) {
    throw new Error('重設密碼服務暫時無法使用，請稍後再試或聯絡客服。');
  }

  const res = await withAuthTimeoutMs(
    fetch('/api/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    '寄送重設密碼信逾時，請稍後再試。',
    RESET_API_TIMEOUT_MS,
  );
  const payload = (await res.json().catch(() => ({}))) as ResetPasswordResponse;
  if (!res.ok || !payload.ok) {
    throw new Error(payload.message || `無法寄出重設密碼 email（${res.status}）`);
  }
  return payload;
}
