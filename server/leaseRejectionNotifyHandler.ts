import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, smtpEnvFromProcess, type SmtpEnv } from './sendEmail.js';

export type LeaseRejectionNotifyEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  smtp: SmtpEnv;
  leaseRejectionFromEmail: string;
  notifySecret: string;
  publicAppUrl: string;
};

export type LeaseRejectionNotifyInput = {
  applicationId: string;
  previousStatus?: string | null;
  authorizationHeader?: string | null;
  notifySecretHeader?: string | null;
};

export type LeaseRejectionNotifyResult = {
  ok: boolean;
  message?: string;
  skipped?: boolean;
  status?: number;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rejectionDetail(previousStatus: string | null): string {
  switch (previousStatus) {
    case 'awaiting_platform_1':
      return '平台初審未能通過。';
    case 'awaiting_landlord':
      return '業主未能接受此申請，或該物業已接受其他租客。';
    case 'awaiting_platform_2':
      return '平台複審未能通過。';
    default:
      return '申請未能通過審批。';
  }
}

async function sendRejectionEmail(
  env: LeaseRejectionNotifyEnv,
  payload: {
    to: string;
    fullName: string;
    propertyTitle: string;
    previousStatus: string | null;
  },
) {
  const from =
    (env.leaseRejectionFromEmail || env.smtp.from).trim();
  const name = payload.fullName.trim() || '租客';
  const title = payload.propertyTitle.trim() || '物業';
  const detail = rejectionDetail(payload.previousStatus);
  const appLink = env.publicAppUrl.replace(/\/$/, '');

  await sendEmail(env.smtp, {
    from,
    to: payload.to,
    subject: '簡屋 · 租約申請結果通知',
    html: `
      <div style="font-family:sans-serif;line-height:1.6;color:#111;max-width:520px">
        <h2 style="margin:0 0 12px;color:#1a365d">簡屋 · 租約申請結果</h2>
        <p>${escapeHtml(name)} 您好，</p>
        <p>您就「<strong>${escapeHtml(title)}</strong>」提交的租約申請<strong>未能通過</strong>。${escapeHtml(detail)}</p>
        <p style="margin:20px 0">
          <a href="${escapeHtml(appLink)}" style="display:inline-block;background:#1a365d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">登入簡屋查看申請</a>
        </p>
        <p style="color:#555;font-size:14px">如有疑問，可透過站內訊息或聯絡客服查詢。</p>
      </div>
    `,
  });
}

async function isAuthorized(
  supabase: SupabaseClient,
  applicationId: string,
  authorizationHeader: string | null | undefined,
  notifySecretHeader: string | null | undefined,
  expectedSecret: string,
): Promise<boolean> {
  if (expectedSecret && notifySecretHeader === expectedSecret) {
    return true;
  }

  const authHeader = authorizationHeader ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return false;
  }

  const uid = userData.user.id;

  const { data: admin } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', uid)
    .maybeSingle();
  if (admin?.user_id) {
    return true;
  }

  const { data: app } = await supabase
    .from('lease_applications')
    .select('landlord_id, status')
    .eq('id', applicationId)
    .maybeSingle();

  return app?.landlord_id === uid && app?.status === 'rejected';
}

export function leaseRejectionNotifyEnvFromProcess(
  env: Record<string, string | undefined>,
): LeaseRejectionNotifyEnv {
  return {
    supabaseUrl: (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
    serviceRoleKey: (env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    smtp: smtpEnvFromProcess(env),
    leaseRejectionFromEmail: (env.LEASE_REJECTION_FROM_EMAIL || '').trim(),
    notifySecret: (env.LEASE_REJECTION_NOTIFY_SECRET || '').trim(),
    publicAppUrl:
      (env.PUBLIC_APP_URL || env.VITE_PUBLIC_APP_URL || 'https://thousehk.com').trim(),
  };
}

export async function handleLeaseRejectionNotify(
  input: LeaseRejectionNotifyInput,
  env: LeaseRejectionNotifyEnv,
): Promise<LeaseRejectionNotifyResult> {
  const applicationId = input.applicationId.trim();
  if (!applicationId) {
    return { ok: false, message: '缺少 application_id。', status: 400 };
  }

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return { ok: false, message: '伺服器設定不完整。', status: 500 };
  }

  const previousStatus =
    input.previousStatus == null || input.previousStatus === ''
      ? null
      : String(input.previousStatus);

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey);

  const authorized = await isAuthorized(
    supabase,
    applicationId,
    input.authorizationHeader,
    input.notifySecretHeader,
    env.notifySecret,
  );
  if (!authorized) {
    return { ok: false, message: 'Unauthorized', status: 401 };
  }

  const { data: sent } = await supabase
    .from('lease_rejection_emails_sent')
    .select('application_id')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (sent?.application_id) {
    return { ok: true, skipped: true, message: '已寄送過。', status: 200 };
  }

  const { data: app, error: appError } = await supabase
    .from('lease_applications')
    .select('id, email, full_name, status, properties(title)')
    .eq('id', applicationId)
    .maybeSingle();

  if (appError) {
    return { ok: false, message: appError.message, status: 500 };
  }
  if (!app) {
    return { ok: false, message: '找不到申請。', status: 404 };
  }
  if (app.status !== 'rejected') {
    return { ok: false, message: '申請尚未為 rejected 狀態。', status: 409 };
  }

  const email = String(app.email ?? '').trim().toLowerCase();
  if (!email) {
    return { ok: false, message: '申請缺少電郵。', status: 400 };
  }

  const propertyTitle =
    app.properties && typeof app.properties === 'object' && 'title' in app.properties
      ? String((app.properties as { title?: string }).title ?? '')
      : '';

  await sendRejectionEmail(env, {
    to: email,
    fullName: String(app.full_name ?? ''),
    propertyTitle,
    previousStatus,
  });

  const { error: insertError } = await supabase.from('lease_rejection_emails_sent').insert({
    application_id: applicationId,
  });

  if (insertError) {
    return { ok: false, message: insertError.message, status: 500 };
  }

  return { ok: true, message: '通知郵件已寄出。', status: 200 };
}
