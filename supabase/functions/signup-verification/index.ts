import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function deriveUsername(email: string) {
  const local = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') ?? '';
  return local || `user${Date.now()}`;
}

async function validateSignupEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('validate_signup_email', { p_email: email });
  if (error) {
    return { ok: false, message: error.message };
  }
  const payload = data as { ok?: boolean; message?: string } | null;
  if (!payload?.ok) {
    return { ok: false, message: payload?.message || '電郵格式不正確。' };
  }
  return { ok: true };
}

async function sendVerificationEmail(email: string, code: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    throw new Error('郵件服務未設定（請在 Supabase 設定 RESEND_API_KEY 並部署 signup-verification Edge Function）。');
  }

  const from = Deno.env.get('RESEND_FROM_EMAIL') || '簡屋 <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: '簡屋註冊驗證碼',
      html: `
        <div style="font-family:sans-serif;line-height:1.6;color:#111">
          <h2 style="margin:0 0 12px">簡屋 · 註冊驗證碼</h2>
          <p>你的驗證碼是：</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:16px 0">${code}</p>
          <p style="color:#555;font-size:14px">驗證碼 10 分鐘內有效。如非本人操作，請忽略此電郵。</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`無法寄出驗證碼郵件：${detail.slice(0, 200)}`);
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const action = String(body.action ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();

    if (!email) {
      return json({ ok: false, message: '請輸入 email。' }, 400);
    }

    if (action === 'send' || action === 'send_existing') {
      if (action === 'send') {
        const check = await validateSignupEmail(supabase, email);
        if (!check.ok) {
          return json({ ok: false, message: check.message }, 400);
        }
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (!profile?.id) {
          return json({ ok: true, message: '若該電郵已註冊，驗證碼已寄出。' });
        }
      }

      const { data: recent } = await supabase
        .from('signup_email_verification_codes')
        .select('created_at')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recent?.created_at) {
        const elapsed = Date.now() - new Date(recent.created_at).getTime();
        if (elapsed < 60_000) {
          return json({ ok: false, message: '請稍候再重新發送驗證碼。' }, 429);
        }
      }

      const code = generateCode();
      const { error: storeError } = await supabase.rpc('store_signup_verification_code', {
        p_email: email,
        p_code: code,
        p_ttl_minutes: 10,
      });
      if (storeError) {
        return json({ ok: false, message: storeError.message }, 500);
      }

      await sendVerificationEmail(email, code);
      return json({ ok: true, message: '驗證碼已寄出。' });
    }

    if (action === 'register') {
      const code = String(body.code ?? '').trim();
      const password = String(body.password ?? '');
      const fullName = String(body.fullName ?? '').trim();

      if (!code) {
        return json({ ok: false, message: '請輸入驗證碼。' }, 400);
      }
      if (!fullName) {
        return json({ ok: false, message: '請輸入名稱。' }, 400);
      }
      if (password.length < 6) {
        return json({ ok: false, message: '密碼至少需要 6 個字元。' }, 400);
      }

      const { data: verified, error: verifyError } = await supabase.rpc('verify_signup_verification_code', {
        p_email: email,
        p_code: code,
      });
      if (verifyError) {
        return json({ ok: false, message: verifyError.message }, 500);
      }
      if (!verified) {
        return json({ ok: false, message: '驗證碼不正確或已過期。' }, 400);
      }

      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: 'tenant',
          username: deriveUsername(email),
        },
      });

      if (createError) {
        return json({ ok: false, message: createError.message }, 400);
      }

      return json({ ok: true, message: '註冊成功。' });
    }

    if (action === 'confirm') {
      const code = String(body.code ?? '').trim();
      if (!code) {
        return json({ ok: false, message: '請輸入驗證碼。' }, 400);
      }

      const { data: verified, error: verifyError } = await supabase.rpc('verify_signup_verification_code', {
        p_email: email,
        p_code: code,
      });
      if (verifyError) {
        return json({ ok: false, message: verifyError.message }, 500);
      }
      if (!verified) {
        return json({ ok: false, message: '驗證碼不正確或已過期。' }, 400);
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profileError) {
        return json({ ok: false, message: profileError.message }, 500);
      }
      if (!profile?.id) {
        return json({ ok: false, message: '找不到帳戶。' }, 404);
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
        email_confirm: true,
      });
      if (updateError) {
        return json({ ok: false, message: updateError.message }, 400);
      }

      return json({ ok: true, message: '電郵已驗證。' });
    }

    return json({ ok: false, message: '不支援的操作。' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return json({ ok: false, message }, 500);
  }
});
