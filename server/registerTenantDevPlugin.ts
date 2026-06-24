import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { handleRegisterTenant } from './registerTenantHandler';

function readJsonBody(req: import('http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function proxyToRegisterFunction(
  env: Record<string, string>,
  body: { username?: string; password?: string; fullName?: string },
) {
  const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anonKey) return null;

  const upstream = await fetch(`${supabaseUrl}/functions/v1/register-tenant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
      fullName: String(body.fullName ?? ''),
    }),
  });

  const payload = (await upstream.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    email?: string;
    status?: number;
  };

  return {
    ok: Boolean(payload.ok),
    message: payload.message,
    email: payload.email,
    status: upstream.status,
  };
}

export function registerTenantDevApi(): Plugin {
  return {
    name: 'register-tenant-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/register-tenant')) {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, message: 'Method not allowed' }));
          return;
        }

        try {
          const env = loadEnv(server.config.mode, server.config.root, '');
          const body = (await readJsonBody(req)) as {
            username?: string;
            password?: string;
            fullName?: string;
          };

          const proxied = await proxyToRegisterFunction(env, body);
          if (proxied) {
            res.statusCode = proxied.ok ? 200 : (proxied.status ?? 400);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(proxied));
            return;
          }

          const result = await handleRegisterTenant(
            {
              username: String(body.username ?? ''),
              password: String(body.password ?? ''),
              fullName: String(body.fullName ?? ''),
            },
            {
              supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL || '',
              serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
            },
          );

          res.statusCode = result.ok ? 200 : (result.status ?? 400);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              message: error instanceof Error ? error.message : '伺服器錯誤',
            }),
          );
        }
      });
    },
  };
}
