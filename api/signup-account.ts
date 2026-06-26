type Req = { method?: string; body?: unknown };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).json(null);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ ok: false, message: '伺服器尚未設定 Supabase。' });
    return;
  }

  const body = (req.body ?? {}) as {
    action?: string;
    email?: string;
    password?: string;
    fullName?: string;
    username?: string;
    role?: string;
  };

  try {
    const upstream = await fetch(`${supabaseUrl}/functions/v1/signup-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        action: String(body.action ?? 'create'),
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
        fullName: String(body.fullName ?? ''),
        username: String(body.username ?? ''),
        role: String(body.role ?? 'tenant'),
      }),
    });

    const payload = (await upstream.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      email?: string;
      emailSent?: boolean;
      emailWarning?: string;
    };

    res.status(upstream.status).json(payload);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : '註冊服務暫時無法使用',
    });
  }
}
