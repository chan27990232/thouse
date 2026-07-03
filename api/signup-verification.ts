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
    action?: string;
    email?: string;
    code?: string;
    password?: string;
    fullName?: string;
    username?: string;
    role?: string;
  };

  try {
    const { handleSignupVerification, signupVerificationEnvFromProcess } = await import(
      '../server/signupVerificationHandler'
    );
    const result = await handleSignupVerification(
      body,
      signupVerificationEnvFromProcess(process.env as Record<string, string | undefined>),
    );
    res.status(result.status ?? (result.ok ? 200 : 500)).json({
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
