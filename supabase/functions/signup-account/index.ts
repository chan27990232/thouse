import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_OTP_TIMEOUT_MS = 25_000;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function resendSignupOtp(
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, message: '伺服器設定不完整。' }, 500);
    }

    const body = await req.json();
    const action = String(body.action ?? 'create');
    const email = String(body.email ?? '').trim().toLowerCase();

    if (action === 'resend') {
      if (!email) {
        return json({ ok: false, message: '請輸入 email。' }, 400);
      }
      const sendResult = await resendSignupOtp(supabaseUrl, serviceRoleKey, email);
      if (!sendResult.ok) {
        return json({ ok: false, message: sendResult.message }, 400);
      }
      return json({ ok: true, emailSent: true });
    }

    const password = String(body.password ?? '');
    const fullName = String(body.fullName ?? '').trim();
    const username = String(body.username ?? '').trim().toLowerCase();
    const role = String(body.role ?? 'tenant') === 'landlord' ? 'landlord' : 'tenant';

    if (!email || !username || !fullName || password.length < 6) {
      return json({ ok: false, message: '註冊資料不完整。' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: emailCheck, error: emailCheckError } = await supabase.rpc('validate_signup_email', {
      p_email: email,
    });
    if (emailCheckError) {
      return json({ ok: false, message: emailCheckError.message }, 500);
    }
    const emailPayload = emailCheck as { ok?: boolean; message?: string } | null;
    if (!emailPayload?.ok) {
      return json({ ok: false, message: emailPayload?.message || '電郵無法使用。' }, 400);
    }

    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id, is_deactivated, username, deactivated_original_username')
      .eq('username', username)
      .maybeSingle();

    if (existingUsername?.id) {
      if (existingUsername.is_deactivated) {
        const archivedUsername = (`x-${String(existingUsername.id).replace(/-/g, '')}`).slice(0, 32);
        const archivedEmail = `${archivedUsername}@thouse.local`;
        const originalUsername = String(
          existingUsername.deactivated_original_username || existingUsername.username || username,
        )
          .trim()
          .toLowerCase();

        const { error: archiveProfileError } = await supabase
          .from('profiles')
          .update({
            deactivated_original_username: originalUsername,
            username: archivedUsername,
            email: archivedEmail,
            is_deactivated: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUsername.id);

        if (archiveProfileError) {
          return json({ ok: false, message: archiveProfileError.message }, 500);
        }

        const { error: archiveAuthError } = await supabase.auth.admin.updateUserById(
          existingUsername.id,
          {
            email: archivedEmail,
            user_metadata: { username: archivedUsername },
          },
        );

        if (archiveAuthError) {
          return json({ ok: false, message: archiveAuthError.message }, 500);
        }
      } else {
        return json({ ok: false, message: '此登入帳號已被使用，請改用另一個。' }, 400);
      }
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName, role, username },
    });

    if (createError) {
      return json({ ok: false, message: createError.message }, 400);
    }

    const userId = created.user?.id;
    if (!userId) {
      return json({ ok: false, message: '建立帳戶失敗。' }, 500);
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        username,
        salutation: '',
        phone: '',
        response_time: '',
        is_verified: false,
        role,
        is_deactivated: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (profileError) {
      return json({ ok: false, message: profileError.message }, 500);
    }

    return json({ ok: true, email, emailSent: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return json({ ok: false, message }, 500);
  }
});
