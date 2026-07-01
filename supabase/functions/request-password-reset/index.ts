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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function resolveAuthEmail(
  supabase: ReturnType<typeof createClient>,
  identifier: string,
): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  const { data, error } = await supabase.rpc('resolve_password_login_email', {
    p_login: trimmed,
  });
  if (error) throw error;
  return typeof data === 'string' && data.trim() ? data.trim().toLowerCase() : null;
}

async function sendRecoveryEmail(to: string, actionLink: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    throw new Error('郵件服務未設定（請在 Supabase 設定 RESEND_API_KEY 並部署 request-password-reset）。');
  }

  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'T-House Limited <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: '簡屋 · 重設密碼',
      html: `
        <div style="font-family:sans-serif;line-height:1.6;color:#111">
          <h2 style="margin:0 0 12px">簡屋 · 重設密碼</h2>
          <p>你好，</p>
          <p>請點擊以下連結重設你的密碼：</p>
          <p style="margin:16px 0">
            <a href="${escapeHtml(actionLink)}" style="color:#1a365d;font-weight:600">重設密碼</a>
          </p>
          <p style="color:#555;font-size:14px">連結僅限短時間內有效。如非本人操作，請忽略此電郵。</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`無法寄出重設密碼郵件：${detail.slice(0, 200)}`);
  }
}

function isUserNotFoundError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('user not found') ||
    m.includes('not found') ||
    m.includes('no user') ||
    m.includes('invalid email')
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, message: '伺服器設定不完整。' }, 500);
    }

    const body = await req.json();
    const identifier = String(body.identifier ?? body.email ?? '').trim();
    const redirectTo =
      String(body.redirectTo ?? '').trim() ||
      Deno.env.get('PUBLIC_APP_URL') ||
      'https://thousehk.com/';

    if (!identifier) {
      return json({ ok: false, message: '請輸入電子郵件或用戶名稱。' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const email = await resolveAuthEmail(supabase, identifier);

    if (!email) {
      return json({
        ok: true,
        message: '若該帳戶存在，重設密碼連結已寄至註冊電郵。',
      });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: redirectTo.replace(/\/$/, '') + '/',
      },
    });

    if (error) {
      if (isUserNotFoundError(error.message)) {
        return json({
          ok: true,
          message: '若該帳戶存在，重設密碼連結已寄至註冊電郵。',
        });
      }
      return json({ ok: false, message: error.message }, 400);
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink || typeof actionLink !== 'string') {
      return json({ ok: false, message: '無法產生重設密碼連結。' }, 500);
    }

    await sendRecoveryEmail(email, actionLink);

    return json({
      ok: true,
      message: '重設密碼連結已寄出，請到註冊電郵收件匣查看。',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return json({ ok: false, message }, 500);
  }
});
