import { supabase } from './supabase';

export type LeaseNoticeType = 'offer' | 'submitted' | 'landlord_accepted' | 'rejected';

export type AppNoticeKind =
  | 'viewing'
  | 'viewingSuccess'
  | 'viewingIgnored'
  | 'leaseOffer'
  | 'leaseSubmitted'
  | 'leaseLandlordAccepted'
  | 'leaseRejected'
  | 'message';

const LEASE_NOTICE_RE = /^\[thouse-lease-notice\]([\s\S]*?)\[\/thouse-lease-notice\]\n?/;

const LEASE_TYPES = new Set<LeaseNoticeType>(['offer', 'submitted', 'landlord_accepted', 'rejected']);

export function parseLeaseNoticePayload(body: string): { type: LeaseNoticeType | null; rest: string } {
  const match = body.match(LEASE_NOTICE_RE);
  if (!match) return { type: null, rest: body };
  try {
    const parsed = JSON.parse(match[1]!) as { type?: string };
    const type = parsed?.type;
    if (type && LEASE_TYPES.has(type as LeaseNoticeType)) {
      return { type: type as LeaseNoticeType, rest: body.slice(match[0].length) };
    }
  } catch {
    /* ignore */
  }
  return { type: null, rest: body };
}

export function buildLeaseNoticeBody(type: LeaseNoticeType, text: string): string {
  const block = `[thouse-lease-notice]${JSON.stringify({ type })}[/thouse-lease-notice]`;
  const trimmed = text.trim();
  return trimmed ? `${block}\n${trimmed}` : block;
}

export function classifyNoticeKind(body: string): AppNoticeKind {
  const raw = body ?? '';
  if (raw.includes('[thouse-viewing-success]')) return 'viewingSuccess';
  if (raw.includes('[thouse-viewing-ignored]')) return 'viewingIgnored';
  if (raw.includes('[thouse-viewing]')) return 'viewing';
  const { type } = parseLeaseNoticePayload(raw);
  if (type === 'offer') return 'leaseOffer';
  if (type === 'submitted') return 'leaseSubmitted';
  if (type === 'landlord_accepted') return 'leaseLandlordAccepted';
  if (type === 'rejected') return 'leaseRejected';
  return 'message';
}

export function isActionNoticeKind(kind: AppNoticeKind): boolean {
  return kind !== 'message';
}

export async function findConversationIdForParties(input: {
  propertyId: string;
  tenantId: string;
  landlordId: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('property_id', input.propertyId)
    .eq('tenant_id', input.tenantId)
    .eq('landlord_id', input.landlordId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}

export async function sendLeaseNoticeMessage(input: {
  conversationId: string;
  senderId: string;
  type: LeaseNoticeType;
  text: string;
}): Promise<void> {
  const body = buildLeaseNoticeBody(input.type, input.text);
  const { error } = await supabase.from('conversation_messages').insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    body,
  });
  if (error) throw error;
}

export async function sendLeaseNoticeForApplication(input: {
  propertyId: string;
  tenantId: string;
  landlordId: string;
  senderId: string;
  type: LeaseNoticeType;
  text: string;
}): Promise<void> {
  const conversationId = await findConversationIdForParties(input);
  if (!conversationId) return;
  await sendLeaseNoticeMessage({
    conversationId,
    senderId: input.senderId,
    type: input.type,
    text: input.text,
  });
}
