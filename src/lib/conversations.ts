import { supabase } from './supabase';

export interface ConversationRow {
  id: string;
  property_id: string;
  landlord_id: string;
  tenant_id: string;
  tenant_display_name: string;
  updated_at: string;
}

export interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface ConversationWithProperty {
  conversation: ConversationRow;
  propertyTitle: string;
  propertyImage: string;
  propertyPrice: number;
  lastMessageBody: string;
  lastMessageAt: string;
  unreadCount: number;
  peerLabel: string;
}

function formatMessageWithContact(params: {
  body: string;
  name: string;
  phone: string;
  email: string;
}) {
  const emailLine = params.email.trim() ? params.email.trim() : '（未提供）';
  return `${params.body.trim()}

---
聯絡人：${params.name.trim()}
電話：${params.phone.trim()}
電郵：${emailLine}`;
}

export async function sendTenantInquiryMessage(params: {
  propertyId: string;
  landlordId: string;
  tenantId: string;
  tenantDisplayName: string;
  message: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}) {
  const fullBody = formatMessageWithContact({
    body: params.message,
    name: params.contactName,
    phone: params.contactPhone,
    email: params.contactEmail,
  });

  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .eq('property_id', params.propertyId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (findError) throw findError;

  let conversationId = existing?.id as string | undefined;

  if (!conversationId) {
    const { data: inserted, error: insertConvError } = await supabase
      .from('conversations')
      .insert({
        property_id: params.propertyId,
        landlord_id: params.landlordId,
        tenant_id: params.tenantId,
        tenant_display_name: params.tenantDisplayName.trim() || params.contactName.trim() || '租客',
      })
      .select('id')
      .single();

    if (insertConvError) throw insertConvError;
    conversationId = inserted?.id as string;
  }

  if (!conversationId) {
    throw new Error('無法建立對話');
  }

  const { error: msgError } = await supabase.from('conversation_messages').insert({
    conversation_id: conversationId,
    sender_id: params.tenantId,
    body: fullBody,
  });

  if (msgError) throw msgError;
}

export async function sendChatMessage(conversationId: string, senderId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const { error } = await supabase.from('conversation_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: trimmed,
  });

  if (error) throw error;
}

export async function fetchUnreadInquiryCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_inquiry_count_for_user');
  if (error) {
    console.error(error);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}

export async function markConversationRead(conversationId: string) {
  const { error } = await supabase.rpc('mark_conversation_messages_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function fetchConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, sender_id, body, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ConversationMessageRow[];
}

function groupMessagesByConversation(
  allMessages: { conversation_id: string; body: string; sender_id: string; read_at: string | null; created_at: string }[]
) {
  const byConv = new Map<string, typeof allMessages>();
  for (const m of allMessages) {
    const arr = byConv.get(m.conversation_id) ?? [];
    arr.push(m);
    byConv.set(m.conversation_id, arr);
  }
  for (const [, arr] of byConv) {
    arr.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }
  return byConv;
}

export async function fetchConversationsForLandlord(landlordId: string): Promise<ConversationWithProperty[]> {
  const { data: convs, error: cErr } = await supabase
    .from('conversations')
    .select('id, property_id, landlord_id, tenant_id, tenant_display_name, updated_at')
    .eq('landlord_id', landlordId)
    .order('updated_at', { ascending: false });

  if (cErr) throw cErr;
  if (!convs?.length) return [];

  const convIds = convs.map((c) => c.id);
  const { data: allMsgs } = await supabase
    .from('conversation_messages')
    .select('conversation_id, body, sender_id, read_at, created_at')
    .in('conversation_id', convIds);

  const msgList = (allMsgs ?? []) as {
    conversation_id: string;
    body: string;
    sender_id: string;
    read_at: string | null;
    created_at: string;
  }[];
  const byConv = groupMessagesByConversation(msgList);

  const propertyIds = [...new Set(convs.map((c) => c.property_id))];
  const { data: props } = await supabase.from('properties').select('id, title, image, price').in('id', propertyIds);
  const propMap = new Map(
    (props ?? []).map((p) => [p.id, { title: p.title, image: p.image, price: Number(p.price ?? 0) }])
  );

  return convs.map((c) => {
    const list = byConv.get(c.id) ?? [];
    const last = list[list.length - 1];
    const unreadCount = list.filter(
      (m) => m.sender_id === c.tenant_id && !m.read_at
    ).length;
    const p = propMap.get(c.property_id);
    return {
      conversation: c as ConversationRow,
      propertyTitle: p?.title ?? '物業',
      propertyImage: p?.image ?? '',
      propertyPrice: p?.price ?? 0,
      lastMessageBody: last?.body ?? '',
      lastMessageAt: last?.created_at ?? c.updated_at,
      unreadCount,
      peerLabel: (c.tenant_display_name || '租客').trim() || '租客',
    };
  });
}

export async function fetchConversationsForTenant(tenantId: string): Promise<ConversationWithProperty[]> {
  const { data: convs, error: cErr } = await supabase
    .from('conversations')
    .select('id, property_id, landlord_id, tenant_id, tenant_display_name, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (cErr) throw cErr;
  if (!convs?.length) return [];

  const convIds = convs.map((c) => c.id);
  const { data: allMsgs } = await supabase
    .from('conversation_messages')
    .select('conversation_id, body, sender_id, read_at, created_at')
    .in('conversation_id', convIds);

  const msgList = (allMsgs ?? []) as {
    conversation_id: string;
    body: string;
    sender_id: string;
    read_at: string | null;
    created_at: string;
  }[];
  const byConv = groupMessagesByConversation(msgList);

  const propertyIds = [...new Set(convs.map((c) => c.property_id))];
  const { data: props } = await supabase.from('properties').select('id, title, image, price').in('id', propertyIds);
  const propMap = new Map(
    (props ?? []).map((p) => [p.id, { title: p.title, image: p.image, price: Number(p.price ?? 0) }])
  );
  const landlordIds = [...new Set(convs.map((c) => c.landlord_id))];
  const landlordLabels = new Map<string, string>();
  for (const lid of landlordIds) {
    const { data: rows } = await supabase.rpc('get_public_landlord_profile', { profile_id: lid });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && typeof row === 'object' && 'full_name' in row) {
      const o = row as { full_name: string; salutation: string };
      const n = o.full_name?.trim() ?? '';
      const s = o.salutation === '先生' || o.salutation === '女士' ? o.salutation : '';
      const surname = n.split(/\s+/)[0] || '';
      landlordLabels.set(lid, s ? `${surname} ${s}` : surname || '業主');
    } else {
      landlordLabels.set(lid, '業主');
    }
  }

  return convs.map((c) => {
    const list = byConv.get(c.id) ?? [];
    const last = list[list.length - 1];
    const unreadCount = list.filter(
      (m) => m.sender_id === c.landlord_id && !m.read_at
    ).length;
    const p = propMap.get(c.property_id);
    return {
      conversation: c as ConversationRow,
      propertyTitle: p?.title ?? '物業',
      propertyImage: p?.image ?? '',
      propertyPrice: p?.price ?? 0,
      lastMessageBody: last?.body ?? '',
      lastMessageAt: last?.created_at ?? c.updated_at,
      unreadCount,
      peerLabel: landlordLabels.get(c.landlord_id) ?? '業主',
    };
  });
}

export interface UnreadNoticeItem {
  id: string;
  messageId: string;
  propertyTitle: string;
  bodyPreview: string;
  createdAt: string;
  fromLabel: string;
}

export async function fetchUnreadNoticesForLandlord(landlordId: string): Promise<UnreadNoticeItem[]> {
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, property_id, tenant_id, tenant_display_name')
    .eq('landlord_id', landlordId);

  if (error) throw error;
  if (!convs?.length) return [];

  const propertyIds = [...new Set(convs.map((c) => c.property_id))];
  const { data: props } = await supabase.from('properties').select('id, title').in('id', propertyIds);
  const titleMap = new Map((props ?? []).map((p) => [p.id, p.title ?? '物業']));

  const items: UnreadNoticeItem[] = [];

  for (const c of convs) {
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('id, body, read_at, created_at, sender_id')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false });

    for (const m of messages ?? []) {
      if (m.sender_id !== c.tenant_id) continue;
      if (m.read_at) continue;
      const preview = m.body.length > 160 ? `${m.body.slice(0, 160)}…` : m.body;
      items.push({
        id: c.id,
        messageId: m.id,
        propertyTitle: titleMap.get(c.property_id) ?? '物業',
        bodyPreview: preview,
        createdAt: m.created_at,
        fromLabel: (c.tenant_display_name || '租客').trim() || '租客',
      });
    }
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}

export async function fetchUnreadNoticesForTenant(tenantId: string): Promise<UnreadNoticeItem[]> {
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, property_id, landlord_id')
    .eq('tenant_id', tenantId);

  if (error) throw error;
  if (!convs?.length) return [];

  const propertyIds = [...new Set(convs.map((c) => c.property_id))];
  const { data: props } = await supabase.from('properties').select('id, title').in('id', propertyIds);
  const titleMap = new Map((props ?? []).map((p) => [p.id, p.title ?? '物業']));

  const landlordIds = [...new Set(convs.map((c) => c.landlord_id))];
  const landlordLabels = new Map<string, string>();
  for (const lid of landlordIds) {
    const { data: rows } = await supabase.rpc('get_public_landlord_profile', { profile_id: lid });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && typeof row === 'object' && 'full_name' in row) {
      const o = row as { full_name: string; salutation: string };
      const n = o.full_name?.trim() ?? '';
      const s = o.salutation === '先生' || o.salutation === '女士' ? o.salutation : '';
      const surname = n.split(/\s+/)[0] || '';
      landlordLabels.set(lid, s ? `${surname} ${s}` : surname || '業主');
    } else {
      landlordLabels.set(lid, '業主');
    }
  }

  const items: UnreadNoticeItem[] = [];

  for (const c of convs) {
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('id, body, read_at, created_at, sender_id')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false });

    for (const m of messages ?? []) {
      if (m.sender_id !== c.landlord_id) continue;
      if (m.read_at) continue;
      const preview = m.body.length > 160 ? `${m.body.slice(0, 160)}…` : m.body;
      items.push({
        id: c.id,
        messageId: m.id,
        propertyTitle: titleMap.get(c.property_id) ?? '物業',
        bodyPreview: preview,
        createdAt: m.created_at,
        fromLabel: landlordLabels.get(c.landlord_id) ?? '業主',
      });
    }
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}
