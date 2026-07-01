import { supabase } from './supabase';

type NotifyResponse = { ok?: boolean; message?: string; skipped?: boolean };

/** 租約申請 rejected 後寄電郵給租客（Supabase Edge Function notify-lease-rejection）。 */
export async function notifyLeaseRejectionByEmail(
  applicationId: string,
  options?: { previousStatus?: string | null },
): Promise<void> {
  const id = applicationId.trim();
  if (!id) return;

  const body: Record<string, string> = { application_id: id };
  if (options?.previousStatus) {
    body.previous_status = options.previousStatus;
  }

  const { data, error } = await supabase.functions.invoke('notify-lease-rejection', { body });
  if (error) {
    console.warn('[lease-rejection-email]', error.message);
    return;
  }

  const payload = (data ?? {}) as NotifyResponse;
  if (!payload.ok && !payload.skipped) {
    console.warn('[lease-rejection-email]', payload.message || 'notify failed');
  }
}
