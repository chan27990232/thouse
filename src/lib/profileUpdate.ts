import { supabase } from './supabase';
import type { AppSalutation } from './salutation';

type FnResponse = { ok: boolean; message?: string };

const PROFILE_UPDATE_TIMEOUT_MS = 30_000;

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('請先登入。');
  return token;
}

async function invokeProfileUpdate(body: Record<string, unknown>): Promise<FnResponse> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROFILE_UPDATE_TIMEOUT_MS);

  try {
    const res = await fetch('/api/profile-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => ({}))) as FnResponse;
    if (!res.ok || !payload.ok) {
      throw new Error(payload.message || `更新失敗（${res.status}）`);
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('請求逾時，請稍後再試。');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function sendProfileEmailChangeOtp(newEmail: string): Promise<void> {
  await invokeProfileUpdate({
    action: 'send_email_otp',
    newEmail: newEmail.trim().toLowerCase(),
  });
}

export async function updateOwnProfile(input: {
  salutation: AppSalutation;
  fullName: string;
  phone: string;
  email: string;
  emailCode?: string;
}): Promise<void> {
  await invokeProfileUpdate({
    action: 'update',
    salutation: input.salutation,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    emailCode: input.emailCode?.trim() || undefined,
  });

  await supabase.auth.refreshSession();
}
