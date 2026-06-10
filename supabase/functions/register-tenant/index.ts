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

function internalEmail(username: string) {
  return `${username.trim().toLowerCase()}@thouse.local`;
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
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const fullName = String(body.fullName ?? '').trim();

    if (!username) {
      return json({ ok: false, message: '請輸入登入帳號。' }, 400);
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return json({ ok: false, message: '登入帳號須為 3–32 字，僅限英文小寫、數字、. _ -' }, 400);
    }
    if (!fullName) {
      return json({ ok: false, message: '請輸入名稱。' }, 400);
    }
    if (password.length < 6) {
      return json({ ok: false, message: '密碼至少需要 6 個字元。' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const email = internalEmail(username);

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (taken?.id) {
      return json({ ok: false, message: '此登入帳號已被使用，請改用另一個。' }, 400);
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'tenant',
        username,
      },
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
        role: 'tenant',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (profileError) {
      return json({ ok: false, message: profileError.message }, 500);
    }

    return json({ ok: true, message: '註冊成功。', email });
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return json({ ok: false, message }, 500);
  }
});
