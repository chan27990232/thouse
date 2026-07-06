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

/** @deprecated 請使用 submitIdentityVerification（identityVerification.ts） */
export async function submitLandlordVerificationRequest(_userId: string): Promise<void> {
  throw new Error('請透過實名驗證表單提交身份證與銀行月結單。');
}

/** @deprecated 請使用 submitIdentityVerification（identityVerification.ts） */
export async function submitTenantVerificationRequest(_userId: string): Promise<void> {
  throw new Error('請透過實名驗證表單提交身份證與銀行月結單。');
}
