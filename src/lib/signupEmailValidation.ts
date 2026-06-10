import { supabase } from './supabase';

export type ValidateSignupEmailResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 以資料庫函式統一檢查註冊用電郵（格式與是否已於 auth.users 存在）。
 * 須先在 Supabase 套用 supabase/validate_signup_email.sql。
 */
export async function validateSignupEmailWithDatabase(email: string): Promise<ValidateSignupEmailResult> {
  const trimmed = email.trim();

  const { data, error } = await supabase.rpc('validate_signup_email', { p_email: trimmed });

  if (error) {
    throw new Error(
      error.code === 'PGRST202' || error.message?.includes('validate_signup_email')
        ? '伺服器尚未啟用電郵檢查。請將 supabase/validate_signup_email.sql 套用到資料庫。'
        : error.message,
    );
  }

  const payload = data as unknown;
  if (!payload || typeof payload !== 'object' || payload === null) {
    throw new Error('電郵驗證回傳格式異常。');
  }

  const ok = Boolean((payload as { ok?: boolean }).ok);
  const message = (payload as { message?: unknown }).message;
  const msg =
    typeof message === 'string' && message.trim() !== '' ? message : '電郵格式不正確。';

  return ok ? { ok: true } : { ok: false, message: msg };
}
