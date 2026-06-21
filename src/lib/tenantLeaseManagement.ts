import { supabase } from './supabase';

export interface TenantRenewInviteSummary {
  id: string;
  leaseApplicationId: string;
  renewalMonths: number | null;
  notes: string;
  createdAt: string;
}

export async function fetchTenantAwaitingRenewInvites(
  leaseApplicationIds: string[]
): Promise<TenantRenewInviteSummary[]> {
  if (leaseApplicationIds.length === 0) return [];

  const { data, error } = await supabase
    .from('lease_management_requests')
    .select('id, lease_application_id, renewal_months, notes, created_at')
    .in('lease_application_id', leaseApplicationIds)
    .eq('request_type', 'renew')
    .eq('status', 'awaiting_tenant')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message.includes('lease_management_requests') || error.message.includes('awaiting_tenant')) {
      return [];
    }
    throw new Error(error.message || '無法載入續約邀請');
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    leaseApplicationId: row.lease_application_id as string,
    renewalMonths: row.renewal_months != null ? Number(row.renewal_months) : null,
    notes: (row.notes as string) ?? '',
    createdAt: row.created_at as string,
  }));
}

export async function respondTenantRenewInvite(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('tenant_respond_lease_renewal', {
    p_request_id: requestId,
    p_accept: accept,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('tenant_respond_lease_renewal') || msg.includes('does not exist')) {
      throw new Error('資料庫尚未套用 lease_renew_tenant_invite.sql');
    }
    throw new Error(msg || '操作失敗');
  }
}
