import { supabase } from './supabase';

export type WalletLedgerEntry = {
  id: string;
  amount: number;
  entryType: string;
  sourceType: string;
  description: string;
  createdAt: string;
};

export type WithdrawalRequest = {
  id: string;
  amount: number;
  payoutMethod: 'bank_transfer' | 'fps';
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  fpsId: string;
  status: string;
  adminNotes: string;
  createdAt: string;
  reviewedAt: string | null;
};

export async function fetchLandlordWalletBalance(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from('landlord_wallets')
    .select('available_balance')
    .eq('landlord_id', user.id)
    .maybeSingle();

  return Number(data?.available_balance ?? 0);
}

/** 累積盈利：歷來入帳（payout_credit）合計，不含提現扣款 */
export async function fetchLandlordCumulativeProfit(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from('landlord_wallet_ledger')
    .select('amount')
    .eq('landlord_id', user.id)
    .eq('entry_type', 'payout_credit');

  if (error || !data) return 0;

  return data.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export async function fetchLandlordWalletLedger(limit = 50): Promise<WalletLedgerEntry[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('landlord_wallet_ledger')
    .select('id, amount, entry_type, source_type, description, created_at')
    .eq('landlord_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    entryType: row.entry_type,
    sourceType: row.source_type,
    description: row.description ?? '',
    createdAt: row.created_at,
  }));
}

export async function fetchLandlordWithdrawalRequests(limit = 30): Promise<WithdrawalRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('landlord_withdrawal_requests')
    .select(
      'id, amount, payout_method, bank_name, account_holder, account_number, fps_id, status, admin_notes, created_at, reviewed_at'
    )
    .eq('landlord_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    payoutMethod: row.payout_method as 'bank_transfer' | 'fps',
    bankName: row.bank_name ?? '',
    accountHolder: row.account_holder ?? '',
    accountNumber: row.account_number ?? '',
    fpsId: row.fps_id ?? '',
    status: row.status,
    adminNotes: row.admin_notes ?? '',
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
}

export function withdrawalStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '待審核';
    case 'processing':
      return '處理中';
    case 'paid':
      return '已出款';
    case 'rejected':
      return '已駁回';
    default:
      return status;
  }
}

export function ledgerEntryLabel(entry: WalletLedgerEntry): string {
  if (entry.description.trim()) return entry.description;
  switch (entry.sourceType) {
    case 'lease_initial':
      return '簽約首期租金入帳';
    case 'rent':
      return '月租入帳';
    case 'utility':
      return '水電煤入帳';
    case 'withdrawal':
      return entry.amount < 0 ? '提現扣款' : '提現退回';
    default:
      return entry.entryType;
  }
}

export async function submitLandlordWithdrawal(input: {
  amount: number;
  payoutMethod: 'bank_transfer' | 'fps';
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  fpsId?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_landlord_withdrawal', {
    p_amount: input.amount,
    p_payout_method: input.payoutMethod,
    p_bank_name: input.bankName ?? '',
    p_account_holder: input.accountHolder ?? '',
    p_account_number: input.accountNumber ?? '',
    p_fps_id: input.fpsId ?? '',
  });

  if (error) {
    throw new Error(error.message);
  }
  return String(data);
}
