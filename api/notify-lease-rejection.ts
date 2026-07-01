import {
  handleLeaseRejectionNotify,
  leaseRejectionNotifyEnvFromProcess,
} from '../server/leaseRejectionNotifyHandler';

type Req = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function headerValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | null {
  const raw = headers?.[name.toLowerCase()] ?? headers?.[name];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-lease-notify-secret');

  if (req.method === 'OPTIONS') {
    res.status(204).json(null);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as {
    application_id?: string;
    previous_status?: string | null;
  };

  try {
    const result = await handleLeaseRejectionNotify(
      {
        applicationId: String(body.application_id ?? ''),
        previousStatus: body.previous_status,
        authorizationHeader: headerValue(req.headers, 'authorization'),
        notifySecretHeader: headerValue(req.headers, 'x-lease-notify-secret'),
      },
      leaseRejectionNotifyEnvFromProcess(process.env as Record<string, string | undefined>),
    );

    res.status(result.status ?? (result.ok ? 200 : 400)).json({
      ok: result.ok,
      message: result.message,
      skipped: result.skipped,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : '伺服器錯誤',
    });
  }
}
