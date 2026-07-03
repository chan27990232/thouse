import { withAuthTimeoutMs } from './signupEmailVerify';

const RESET_API_TIMEOUT_MS = 30_000;

type ResetPasswordResponse = {
  ok: boolean;
  message?: string;
};

export async function invokeRequestPasswordReset(body: {
  identifier: string;
  redirectTo: string;
}): Promise<ResetPasswordResponse> {
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
