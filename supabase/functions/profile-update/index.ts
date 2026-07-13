import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendEmail, smtpEnvFromDeno } from '../_shared/smtp.ts';

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, message: '伺服器設定不完整。' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ ok: false, message: '請先登入。' }, 401);

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ ok: false, message: '登入已失效，請重新登入。' }, 401);
    }

    const user = userData.user;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const action = String(body.action ?? 'update');

    if (action === 'send_email_otp') {
      const newEmail = normalizeEmail(String(body.newEmail ?? body.email ?? ''));
      if (!newEmail) return json({ ok: false, message: '請輸入新電郵。' }, 400);
      if (newEmail === normalizeEmail(user.email ?? '')) {
        return json({ ok: false, message: '新電郵與目前電郵相同。' }, 400);
      }

      const { data: check, error: checkError } = await admin.rpc('validate_signup_email', { p_email: newEmail });
      if (checkError) return json({ ok: false, message: checkError.message }, 500);
      const payload = check as { ok?: boolean; message?: string } | null;
      if (!payload?.ok) return json({ ok: false, message: payload?.message || '電郵無法使用。' }, 400);

      const { data: recent } = await admin
        .from('signup_email_verification_codes')
        .select('created_at')
        .eq('email', newEmail)
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
      const { error: storeError } = await admin.rpc('store_signup_verification_code', {
        p_email: newEmail,
        p_code: code,
        p_ttl_minutes: 10,
      });
      if (storeError) return json({ ok: false, message: storeError.message }, 500);

      await sendEmail(smtpEnvFromDeno(), {
        to: newEmail,
        subject: '簡屋 · 更改電郵驗證碼',
        html: `
          <div style="font-family:sans-serif;line-height:1.6;color:#111">
            <h2 style="margin:0 0 12px">簡屋 · 更改電郵驗證碼</h2>
            <p>你的驗證碼是：</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:16px 0">${code}</p>
            <p style="color:#555;font-size:14px">驗證碼 10 分鐘內有效。如非本人操作，請忽略此電郵。</p>
          </div>
        `,
      });

      return json({ ok: true, message: '驗證碼已寄出。' });
    }

    if (action === 'update') {
      const salutation =
        body.salutation === '先生' || body.salutation === '女士' || body.salutation === '不便透露'
          ? body.salutation
          : '';
      const fullName = String(body.fullName ?? '').trim();
      const phone = String(body.phone ?? '').trim();
      const nextEmail = normalizeEmail(String(body.email ?? user.email ?? ''));
      const currentEmail = normalizeEmail(user.email ?? '');

      if (!fullName) return json({ ok: false, message: '請輸入姓名。' }, 400);

      const emailChanged = nextEmail !== currentEmail;
      if (emailChanged) {
        const code = String(body.emailCode ?? '').trim();
        if (!code) return json({ ok: false, message: '更改電郵須先輸入驗證碼。' }, 400);

        const { data: emailCheck } = await admin.rpc('validate_signup_email', { p_email: nextEmail });
        const emailPayload = emailCheck as { ok?: boolean; message?: string } | null;
        if (!emailPayload?.ok) {
          return json({ ok: false, message: emailPayload?.message || '電郵無法使用。' }, 400);
        }

        const { data: verified, error: verifyError } = await admin.rpc('verify_signup_verification_code', {
          p_email: nextEmail,
          p_code: code,
        });
        if (verifyError) return json({ ok: false, message: verifyError.message }, 500);
        if (!verified) return json({ ok: false, message: '驗證碼不正確或已過期。' }, 400);

        const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
          email: nextEmail,
          email_confirm: true,
        });
        if (authUpdateError) return json({ ok: false, message: authUpdateError.message }, 400);
      }

      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({
          salutation,
          full_name: fullName,
          phone,
          ...(emailChanged ? { email: nextEmail } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileUpdateError) {
        const msg = (profileUpdateError.message || '').toLowerCase();
        if (msg.includes('display_name_change_limit')) {
          return json({ ok: false, message: '用戶名稱每 14 天最多只能修改 2 次，請稍後再試。' }, 400);
        }
        return json({ ok: false, message: profileUpdateError.message }, 500);
      }

      const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(typeof user.user_metadata === 'object' && user.user_metadata ? user.user_metadata : {}),
          salutation,
          full_name: fullName,
          phone,
        },
      });
      if (metadataError) return json({ ok: false, message: metadataError.message }, 400);

      return json({ ok: true, message: '個人資料已更新。' });
    }

    return json({ ok: false, message: '不支援的操作。' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return json({ ok: false, message }, 500);
  }
});
