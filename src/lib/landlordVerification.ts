import { supabase } from './supabase';

/** 把 PostgREST / 缺欄位錯誤轉成可讀說明（業主或租客實名欄位） */
export function formatIdentityVerificationSchemaError(message: string): string {
  const m = message.toLowerCase();
  if (
    (m.includes('landlord_verification') || m.includes('tenant_verification')) &&
    (m.includes('column') || m.includes('schema') || m.includes('could not find'))
  ) {
    return '資料庫尚未啟用實名驗證欄位。請在 Supabase 執行 supabase/landlord_verification.sql 與 supabase/tenant_verification.sql（或 node scripts/apply-database.mjs）後再試。';
  }
  return message;
}

/** @deprecated 使用 formatIdentityVerificationSchemaError */
export const formatLandlordVerificationSchemaError = formatIdentityVerificationSchemaError;

/** 業主提交實名驗證申請（RLS + trigger：僅 none/rejected → pending） */
export async function submitLandlordVerificationRequest(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ landlord_verification_status: 'pending' })
    .eq('id', userId)
    .eq('role', 'landlord')
    .select('id');

  if (error) {
    throw new Error(formatIdentityVerificationSchemaError(error.message || '無法提交驗證申請'));
  }
  if (!data?.length) {
    throw new Error('無法提交：請確認帳戶為業主，或目前狀態不允許再次申請。');
  }
}

/** 租客提交實名驗證申請 */
export async function submitTenantVerificationRequest(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ tenant_verification_status: 'pending' })
    .eq('id', userId)
    .eq('role', 'tenant')
    .select('id');

  if (error) {
    throw new Error(formatIdentityVerificationSchemaError(error.message || '無法提交驗證申請'));
  }
  if (!data?.length) {
    throw new Error('無法提交：請確認帳戶為租客，或目前狀態不允許再次申請。');
  }
}
