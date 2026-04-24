import { supabase } from './supabase';

export interface StarSummary {
  avgStars: number;
  reviewCount: number;
}

export async function getProfileStarSummary(profileId: string): Promise<StarSummary> {
  const { data, error } = await supabase.rpc('get_profile_star_summary', {
    p_profile_id: profileId,
  });
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('function') && msg.includes('does not exist')) {
      throw new Error('尚未套用資料庫交易評價相關 SQL（supabase/transaction_reviews.sql）。');
    }
    throw new Error(error.message || '無法讀取評分摘要');
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return { avgStars: 0, reviewCount: 0 };
  }
  const o = row as { avg_stars: unknown; review_count: unknown };
  return {
    avgStars: Number(o.avg_stars ?? 0),
    reviewCount: Number(o.review_count ?? 0),
  };
}

type LeaseWithProperty = {
  id: string;
  tenant_id: string;
  landlord_id: string;
  full_name: string;
  created_at: string;
  /** Supabase 嵌套欄位 */
  properties: { title: string } | { title: string }[] | null;
};

function propertyTitle(row: LeaseWithProperty) {
  const p = row.properties;
  if (Array.isArray(p)) return p[0]?.title ?? '物業';
  return p?.title ?? '物業';
}

export interface PendingLeaseForReview {
  leaseApplicationId: string;
  propertyTitle: string;
  otherRoleLabel: '租客' | '業主';
  otherPartyName: string;
  toUserId: string;
  createdAt: string;
}

/**
 * 已核准、且本人尚未留評的簽約（租客／業主皆可）。
 */
export async function fetchPendingLeasesToReview(): Promise<PendingLeaseForReview[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: leases, error: e1 } = await supabase
    .from('lease_applications')
    .select('id, tenant_id, landlord_id, full_name, created_at, properties ( title )')
    .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (e1) {
    const m = (e1.message || '').toLowerCase();
    if (m.includes('lease_applications') || m.includes('column')) {
      throw new Error(e1.message);
    }
    throw new Error(e1.message || '無法讀取簽約');
  }
  if (!leases?.length) return [];

  const { data: mine, error: e2 } = await supabase
    .from('transaction_reviews')
    .select('lease_application_id')
    .eq('from_user_id', user.id);
  if (e2) throw new Error(e2.message || '無法讀取評價狀態');

  const already = new Set((mine ?? []).map((r) => r.lease_application_id as string));
  const out: PendingLeaseForReview[] = [];

  for (const raw of leases as LeaseWithProperty[]) {
    if (already.has(raw.id)) continue;
    const imTenant = raw.tenant_id === user.id;
    const toUserId = imTenant ? raw.landlord_id : raw.tenant_id;
    out.push({
      leaseApplicationId: raw.id,
      propertyTitle: propertyTitle(raw),
      otherRoleLabel: imTenant ? '業主' : '租客',
      otherPartyName: imTenant ? '此租約的業主' : (raw.full_name || '租客').trim() || '租客',
      toUserId,
      createdAt: raw.created_at,
    });
  }
  return out;
}

export interface ReceivedReview {
  id: string;
  stars: number;
  comment: string;
  createdAt: string;
  propertyTitle: string;
  fromRole: 'tenant' | 'landlord';
  fromNameHint: string;
}

/**
 * 他人對我的交易評價（依 RLS 僅能讀寫到與己相關者）。
 */
export async function fetchReviewsReceivedByMe(): Promise<ReceivedReview[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: reviews, error } = await supabase
    .from('transaction_reviews')
    .select('id, stars, comment, created_at, from_user_id, lease_application_id')
    .eq('to_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('does not exist') || m.includes('transaction_reviews')) {
      return [];
    }
    throw new Error(error.message || '無法讀取評價');
  }
  if (!reviews?.length) return [];

  const leaseIds = [...new Set(reviews.map((r) => r.lease_application_id as string))];
  const { data: leases, error: le } = await supabase
    .from('lease_applications')
    .select('id, tenant_id, landlord_id, full_name, properties ( title )')
    .in('id', leaseIds);

  if (le) throw new Error(le.message || '無法讀取簽約');

  const leaseMap = new Map(
    (leases ?? []).map((row) => {
      const la = row as LeaseWithProperty;
      return [la.id, la] as const;
    })
  );

  return reviews.map((r) => {
    const la = leaseMap.get(r.lease_application_id as string);
    const p = la?.properties;
    const ptitle = Array.isArray(p) ? p[0]?.title : p?.title;
    const title = ptitle ?? '物業';
    const isFromTenant = la ? r.from_user_id === la.tenant_id : false;
    const fromNameHint = isFromTenant
      ? ((la?.full_name || '租客').trim() || '租客')
      : '此租約的業主';
    return {
      id: r.id as string,
      stars: r.stars as number,
      comment: (typeof r.comment === 'string' ? r.comment : '').trim(),
      createdAt: r.created_at as string,
      propertyTitle: title,
      fromRole: isFromTenant ? ('tenant' as const) : ('landlord' as const),
      fromNameHint,
    };
  });
}

export async function submitTransactionReview(input: {
  leaseApplicationId: string;
  toUserId: string;
  stars: number;
  comment: string;
}): Promise<void> {
  if (input.stars < 1 || input.stars > 5 || !Number.isInteger(input.stars)) {
    throw new Error('請選擇 1–5 星');
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const { error } = await supabase.from('transaction_reviews').insert({
    lease_application_id: input.leaseApplicationId,
    from_user_id: user.id,
    to_user_id: input.toUserId,
    stars: input.stars,
    comment: (input.comment ?? '').trim(),
  });
  if (error) {
    if ((error.message || '').includes('unique') || (error.code ?? '') === '23505') {
      throw new Error('此筆簽約您已留過評價');
    }
    throw new Error(error.message || '提交失敗');
  }
}
