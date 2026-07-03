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
    identifier?: string;
    email?: string;
    redirectTo?: string;
  };

  try {
    const { handleRequestPasswordReset, requestPasswordResetEnvFromProcess } = await import(
      '../server/requestPasswordResetHandler'
    );
    const result = await handleRequestPasswordReset(
      body,
      requestPasswordResetEnvFromProcess(process.env as Record<string, string | undefined>),
    );
    res.status(result.status ?? (result.ok ? 200 : 500)).json({
      ok: result.ok,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : '重設密碼服務暫時無法使用',
    });
  }
}
