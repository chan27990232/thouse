import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { handleRegisterTenant } from './registerTenantHandler';
import { handleSignupAccount, handleResendSignupOtp } from './signupAccountHandler';
import {
  handleLeaseRejectionNotify,
  leaseRejectionNotifyEnvFromProcess,
} from './leaseRejectionNotifyHandler';
import {
  handleSignupVerification,
  signupVerificationEnvFromProcess,
} from './signupVerificationHandler';

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

async function proxyToSignupFunction(
  env: Record<string, string>,
  body: {
    action?: string;
    email?: string;
    password?: string;
    fullName?: string;
    username?: string;
    role?: string;
  },
) {
  const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anonKey) return null;

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
    status?: number;
  };

  return {
    ok: Boolean(payload.ok),
    message: payload.message,
    email: payload.email,
    emailSent: payload.emailSent,
    emailWarning: payload.emailWarning,
    status: upstream.status,
  };
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

async function proxyToRequestPasswordReset(
  env: Record<string, string>,
  body: { identifier?: string; email?: string; redirectTo?: string },
) {
  const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anonKey) return null;

  const upstream = await fetch(`${supabaseUrl}/functions/v1/request-password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      identifier: String(body.identifier ?? body.email ?? ''),
      redirectTo: String(body.redirectTo ?? ''),
    }),
  });

  const payload = (await upstream.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
  };

  return {
    ok: Boolean(payload.ok),
    message: payload.message,
    status: upstream.status,
  };
}

export function registerTenantDevApi(): Plugin {
  return {
    name: 'register-tenant-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const isRegisterTenant = req.url?.startsWith('/api/register-tenant');
        const isSignupAccount = req.url?.startsWith('/api/signup-account');
        const isRequestPasswordReset = req.url?.startsWith('/api/request-password-reset');
        const isLeaseRejectionNotify = req.url?.startsWith('/api/notify-lease-rejection');
        const isSignupVerification = req.url?.startsWith('/api/signup-verification');
        if (
          !isRegisterTenant &&
          !isSignupAccount &&
          !isRequestPasswordReset &&
          !isLeaseRejectionNotify &&
          !isSignupVerification
        ) {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, x-lease-notify-secret',
          );
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
            action?: string;
            email?: string;
            identifier?: string;
            redirectTo?: string;
            username?: string;
            password?: string;
            fullName?: string;
            role?: string;
            code?: string;
            application_id?: string;
            previous_status?: string | null;
          };

          if (isSignupVerification) {
            const result = await handleSignupVerification(
              {
                action: body.action,
                email: body.email,
                code: body.code,
                password: body.password,
                fullName: body.fullName,
              },
              signupVerificationEnvFromProcess(env),
            );
            res.statusCode = result.status ?? (result.ok ? 200 : 400);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: result.ok, message: result.message }));
            return;
          }

          if (isLeaseRejectionNotify) {
            const result = await handleLeaseRejectionNotify(
              {
                applicationId: String(body.application_id ?? ''),
                previousStatus: body.previous_status,
                authorizationHeader: req.headers.authorization ?? null,
                notifySecretHeader:
                  (req.headers['x-lease-notify-secret'] as string | undefined) ?? null,
              },
              leaseRejectionNotifyEnvFromProcess(env),
            );
            res.statusCode = result.status ?? (result.ok ? 200 : 400);
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: result.ok,
                message: result.message,
                skipped: result.skipped,
              }),
            );
            return;
          }

          if (isRequestPasswordReset) {
            const proxied = await proxyToRequestPasswordReset(env, body);
            if (proxied) {
              res.statusCode = proxied.ok ? 200 : (proxied.status ?? 400);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(proxied));
              return;
            }
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, message: '重設密碼服務未設定。' }));
            return;
          }

          if (isSignupAccount) {
            const proxied = await proxyToSignupFunction(env, body);
            if (proxied) {
              res.statusCode = proxied.ok ? 200 : (proxied.status ?? 400);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(proxied));
              return;
            }

            const supabaseEnv = {
              supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL || '',
              serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
            };

            if (String(body.action ?? 'create') === 'resend') {
              const result = await handleResendSignupOtp(String(body.email ?? ''), supabaseEnv);
              res.statusCode = result.ok ? 200 : (result.status ?? 400);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
              return;
            }

            const result = await handleSignupAccount(
              {
                email: String(body.email ?? ''),
                password: String(body.password ?? ''),
                fullName: String(body.fullName ?? ''),
                username: String(body.username ?? ''),
                role: String(body.role ?? 'tenant') === 'landlord' ? 'landlord' : 'tenant',
              },
              supabaseEnv,
            );

            res.statusCode = result.ok ? 200 : (result.status ?? 400);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
            return;
          }

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
