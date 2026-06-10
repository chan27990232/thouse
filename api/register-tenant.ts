import { handleRegisterTenant } from '../server/registerTenantHandler';

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

  const body = (req.body ?? {}) as {
    username?: string;
    password?: string;
    fullName?: string;
  };

  const result = await handleRegisterTenant(
    {
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
      fullName: String(body.fullName ?? ''),
    },
    {
      supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
  );

  if (!result.ok) {
    res.status(result.status ?? 400).json(result);
    return;
  }

  res.status(200).json(result);
}
