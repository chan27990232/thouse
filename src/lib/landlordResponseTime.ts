import { responseTimeMessages } from '../content/translations/responseTime';
import type { AppLocale } from './locale';
import { supabase } from './supabase';

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function formatResponseDuration(ms: number, locale: AppLocale): string {
  const t = responseTimeMessages[locale];
  if (!Number.isFinite(ms) || ms < 0) return t.noData;
  if (ms < MS_HOUR) return t.withinHour;
  if (ms < MS_DAY) {
    const hours = Math.max(1, Math.round(ms / MS_HOUR));
    return t.withinHours.replace('{hours}', String(hours));
  }
  const days = Math.max(1, Math.round(ms / MS_DAY));
  return days === 1 ? t.withinDay : t.withinDays.replace('{days}', String(days));
}

/** 依站內聊天回覆紀錄計算業主平均回覆時間（租客訊息 → 業主下一則回覆）。 */
export async function computeLandlordResponseTimeLabel(
  landlordId: string,
  locale: AppLocale = 'zh-TW',
): Promise<string> {
  const trimmed = landlordId.trim();
  if (!trimmed) return responseTimeMessages[locale].noData;

  const { data: convs, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('landlord_id', trimmed);

  if (convErr || !convs?.length) return responseTimeMessages[locale].noData;

  const convIds = convs.map((c) => c.id as string);
  const { data: msgs, error: msgErr } = await supabase
    .from('conversation_messages')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true });

  if (msgErr || !msgs?.length) return responseTimeMessages[locale].noData;

  const byConv = new Map<string, { sender_id: string; created_at: string }[]>();
  for (const row of msgs) {
    const cid = row.conversation_id as string;
    const list = byConv.get(cid) ?? [];
    list.push({ sender_id: row.sender_id as string, created_at: row.created_at as string });
    byConv.set(cid, list);
  }

  const deltas: number[] = [];
  for (const list of byConv.values()) {
    let pendingTenantAt: number | null = null;
    for (const msg of list) {
      const at = new Date(msg.created_at).getTime();
      if (!Number.isFinite(at)) continue;
      if (msg.sender_id !== trimmed) {
        pendingTenantAt = at;
        continue;
      }
      if (pendingTenantAt != null && at >= pendingTenantAt) {
        deltas.push(at - pendingTenantAt);
        pendingTenantAt = null;
      }
    }
  }

  if (deltas.length === 0) return responseTimeMessages[locale].noData;

  const avg = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  return formatResponseDuration(avg, locale);
}
