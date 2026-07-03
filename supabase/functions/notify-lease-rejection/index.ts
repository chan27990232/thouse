import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendEmail, smtpEnvFromDeno } from '../_shared/smtp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lease-notify-secret',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

async function sendRejectionEmail(payload: {
  to: string;
  fullName: string;
  propertyTitle: string;
  previousStatus: string | null;
  appUrl: string;
}) {
  const smtp = smtpEnvFromDeno();
  const from = (Deno.env.get('LEASE_REJECTION_FROM_EMAIL') || smtp.from).trim();
  const name = payload.fullName.trim() || '租客';
  const title = payload.propertyTitle.trim() || '物業';
  const detail = rejectionDetail(payload.previousStatus);
  const appLink = payload.appUrl.replace(/\/$/, '');

  await sendEmail(smtp, {
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
  req: Request,
  supabase: SupabaseClient,
  applicationId: string,
): Promise<boolean> {
  const expectedSecret = Deno.env.get('LEASE_REJECTION_NOTIFY_SECRET');
  const providedSecret = req.headers.get('x-lease-notify-secret') ?? '';
  if (expectedSecret && providedSecret === expectedSecret) {
    return true;
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, message: '伺服器設定不完整。' }, 500);
    }

    const body = await req.json();
    const applicationId = String(body.application_id ?? '').trim();
    const previousStatus =
      body.previous_status == null || body.previous_status === ''
        ? null
        : String(body.previous_status);

    if (!applicationId) {
      return json({ ok: false, message: '缺少 application_id。' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authorized = await isAuthorized(req, supabase, applicationId);
    if (!authorized) {
      return json({ ok: false, message: 'Unauthorized' }, 401);
    }

    const { data: sent } = await supabase
      .from('lease_rejection_emails_sent')
      .select('application_id')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (sent?.application_id) {
      return json({ ok: true, skipped: true, message: '已寄送過。' });
    }

    const { data: app, error: appError } = await supabase
      .from('lease_applications')
      .select('id, email, full_name, status, properties(title)')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) {
      return json({ ok: false, message: appError.message }, 500);
    }
    if (!app) {
      return json({ ok: false, message: '找不到申請。' }, 404);
    }
    if (app.status !== 'rejected') {
      return json({ ok: false, message: '申請尚未為 rejected 狀態。' }, 409);
    }

    const email = String(app.email ?? '').trim().toLowerCase();
    if (!email) {
      return json({ ok: false, message: '申請缺少電郵。' }, 400);
    }

    const propertyTitle =
      app.properties && typeof app.properties === 'object' && 'title' in app.properties
        ? String((app.properties as { title?: string }).title ?? '')
        : '';

    const appUrl =
      Deno.env.get('PUBLIC_APP_URL') ||
      Deno.env.get('VITE_PUBLIC_APP_URL') ||
      'https://thousehk.com';

    await sendRejectionEmail({
      to: email,
      fullName: String(app.full_name ?? ''),
      propertyTitle,
      previousStatus,
      appUrl,
    });

    const { error: insertError } = await supabase.from('lease_rejection_emails_sent').insert({
      application_id: applicationId,
    });

    if (insertError) {
      return json({ ok: false, message: insertError.message }, 500);
    }

    return json({ ok: true, message: '通知郵件已寄出。' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤';
    return json({ ok: false, message }, 500);
  }
});
