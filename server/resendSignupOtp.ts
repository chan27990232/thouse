const RESEND_OTP_TIMEOUT_MS = 25_000;

export async function resendSignupOtpEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEND_OTP_TIMEOUT_MS);

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ type: 'signup', email: normalizedEmail }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = '無法寄出驗證碼';
      try {
        const payload = JSON.parse(text) as { msg?: string; message?: string; error_description?: string };
        message = payload.msg || payload.message || payload.error_description || message;
      } catch {
        if (text.trim()) {
          message = text.trim().slice(0, 200);
        }
      }
      return { ok: false, message };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        message: '驗證碼寄送逾時。請至 Supabase → Authentication → SMTP 確認寄信設定後再試。',
      };
    }
    const message = error instanceof Error ? error.message : '無法寄出驗證碼';
    return { ok: false, message };
  } finally {
    clearTimeout(timer);
  }
}
