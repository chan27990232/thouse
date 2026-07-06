import { supabase } from './supabase';
import { formatIdentityVerificationSchemaError } from './landlordVerification';

const BUCKET = 'identity-verification';

function extFromName(filename: string, fallback: string) {
  const e = filename.split('.').pop();
  if (e && e.length <= 6) return e.toLowerCase();
  return fallback;
}

export async function uploadIdentityVerificationFile(
  userId: string,
  file: File,
  kind: 'id-card' | 'bank-statement',
  index = 0,
): Promise<string> {
  const ext = extFromName(file.name, kind === 'id-card' ? 'jpg' : 'pdf');
  const tag = kind === 'id-card' ? 'id-card' : `bank-${index}`;
  const path = `${userId}/${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) {
    throw new Error(
      `上傳失敗：${error.message}。請確認已套用 identity_verification_submissions.sql。`,
    );
  }
  return path;
}

export interface IdentityVerificationFormInput {
  role: 'tenant' | 'landlord';
  legalName: string;
  idNumber: string;
  dateOfBirth: string;
  idCardFile: File;
  bankStatementFile: File;
}

const RPC_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: '未登入。',
  invalid_role: '帳戶類型無效。',
  legal_name_required: '請填寫證件姓名。',
  id_number_required: '請填寫身份證號碼。',
  date_of_birth_required: '請填寫出生日期。',
  id_card_required: '請上傳身份證照片。',
  bank_statements_required: '請上傳一份銀行月結單。',
  profile_not_found: '找不到帳戶資料。',
  role_mismatch: '帳戶類型不符。',
  already_verified: '帳戶已通過驗證。',
  verification_not_allowed: '目前狀態無法提交驗證申請。',
  invalid_id_card_path: '身份證檔案路徑無效。',
  invalid_bank_statement_path: '銀行月結單檔案路徑無效。',
};

function mapRpcError(message: string): string {
  const key = message.toLowerCase().trim();
  for (const [code, text] of Object.entries(RPC_ERROR_MESSAGES)) {
    if (key.includes(code)) return text;
  }
  return formatIdentityVerificationSchemaError(message);
}

export function validateHongKongIdNumber(value: string): boolean {
  const v = value.trim().toUpperCase();
  return /^[A-Z]{1,2}\d{6}\([0-9A]\)$/.test(v);
}

export async function submitIdentityVerification(input: IdentityVerificationFormInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(RPC_ERROR_MESSAGES.not_authenticated);

  const idCardPath = await uploadIdentityVerificationFile(user.id, input.idCardFile, 'id-card');
  const bankPath = await uploadIdentityVerificationFile(user.id, input.bankStatementFile, 'bank-statement');

  const { error } = await supabase.rpc('submit_identity_verification', {
    p_role: input.role,
    p_legal_name: input.legalName.trim(),
    p_id_number: input.idNumber.trim().toUpperCase(),
    p_date_of_birth: input.dateOfBirth,
    p_id_card_path: idCardPath,
    p_bank_statement_paths: [bankPath],
    p_bank_statement_months: [],
  });

  if (error) {
    throw new Error(mapRpcError(error.message || '無法提交驗證申請'));
  }
}

export interface IdentityVerificationSubmission {
  id: string;
  legal_name: string;
  id_number: string;
  date_of_birth: string | null;
  id_card_path: string;
  bank_statement_paths: string[];
  bank_statement_months: string[];
  created_at: string;
}

export async function getLatestIdentityVerificationSubmission(userId: string) {
  const { data, error } = await supabase
    .from('identity_verification_submissions')
    .select(
      'id, legal_name, id_number, date_of_birth, id_card_path, bank_statement_paths, bank_statement_months, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes('identity_verification_submissions') ||
      error.message.includes('does not exist')
    ) {
      return null;
    }
    throw error;
  }
  return (data as IdentityVerificationSubmission | null) ?? null;
}

export async function signedIdentityVerificationUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}
