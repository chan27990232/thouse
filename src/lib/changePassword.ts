import { supabase } from './supabase';
import { validatePasswordStrength } from './passwordValidation';

export const PASSWORD_CHANGE_LIMIT_MESSAGE = '14天內只可修改一次密碼。';

export interface PasswordChangeQuota {
  changesInWindow: number;
  maxChanges: number;
  windowDays: number;
  remaining: number;
  locked: boolean;
}

function parseQuota(data: unknown): PasswordChangeQuota {
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const changesInWindow = Number(row.changes_in_window ?? 0) || 0;
  const maxChanges = Number(row.max_changes ?? 1) || 1;
  const windowDays = Number(row.window_days ?? 14) || 14;
  const remaining = Math.max(0, maxChanges - changesInWindow);
  return {
    changesInWindow,
    maxChanges,
    windowDays,
    remaining,
    locked: remaining <= 0,
  };
}

export async function getPasswordChangeQuota(): Promise<PasswordChangeQuota> {
  const { data, error } = await supabase.rpc('get_password_change_quota');
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('function') && msg.includes('does not exist')) {
      return {
        changesInWindow: 0,
        maxChanges: 1,
        windowDays: 14,
        remaining: 1,
        locked: false,
      };
    }
    throw error;
  }
  return parseQuota(data);
}

async function claimPasswordChangeSlot() {
  const { error } = await supabase.rpc('claim_password_change');
  if (!error) return;

  const msg = error.message || '';
  if (msg.includes('password_change_limit')) {
    throw new Error(PASSWORD_CHANGE_LIMIT_MESSAGE);
  }
  if (msg.toLowerCase().includes('function') && msg.toLowerCase().includes('does not exist')) {
    throw new Error('尚未套用密碼修改限制 SQL（supabase/profile_password_changes.sql）。');
  }
  throw new Error(msg || '無法檢查密碼修改次數，請稍後再試。');
}

async function undoPasswordChangeClaim() {
  try {
    await supabase.rpc('undo_latest_password_change_claim');
  } catch {
    // best-effort rollback
  }
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  const confirmPassword = input.confirmPassword;

  if (!currentPassword) {
    throw new Error('請輸入目前密碼。');
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    throw new Error(strengthError);
  }

  if (newPassword !== confirmPassword) {
    throw new Error('兩次輸入的新密碼不一致。');
  }

  if (newPassword === currentPassword) {
    throw new Error('新密碼不可與目前密碼相同。');
  }

  const quota = await getPasswordChangeQuota();
  if (quota.locked) {
    throw new Error(PASSWORD_CHANGE_LIMIT_MESSAGE);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user?.email) {
    throw new Error('未登入或帳戶缺少 Email，無法更改密碼。');
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    throw new Error('目前密碼不正確。');
  }

  await claimPasswordChangeSlot();

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    await undoPasswordChangeClaim();
    throw new Error(updateError.message || '更改密碼失敗，請稍後再試。');
  }
}
