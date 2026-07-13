import {
  handleProfileUpdate,
  profileUpdateEnvFromProcess,
} from '../server/profileUpdateHandler.js';

type Req = {
  method?: string;
  body?: unknown;
  headers?: { authorization?: string; Authorization?: string };
};
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).json(null);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  const env = profileUpdateEnvFromProcess(process.env as Record<string, string | undefined>);
  if (!env) {
    res.status(500).json({ ok: false, message: '伺服器設定不完整。' });
    return;
  }

  const body = (req.body ?? {}) as {
    action?: string;
    newEmail?: string;
    salutation?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    emailCode?: string;
    code?: string;
  };

  const authorization =
    req.headers?.authorization ?? req.headers?.Authorization ?? null;

  try {
    const result = await handleProfileUpdate(
      {
        action: body.action,
        newEmail: body.newEmail ?? body.email,
        salutation: body.salutation,
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        emailCode: body.emailCode ?? body.code,
      },
      env,
      authorization,
    );
    res.status(result.status ?? (result.ok ? 200 : 400)).json({
      ok: result.ok,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : '伺服器錯誤',
    });
  }
}
