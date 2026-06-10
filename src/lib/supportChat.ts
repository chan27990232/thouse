import { supabase } from './supabase';

export const THOUSE_SUPPORT_PIN_ID = '__thouse_support__';
export const THOUSE_SUPPORT_LABEL = 'Thouse 客服';
export const THOUSE_SUPPORT_SUBJECT = 'Thouse 客服';

export interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  updated_at: string;
  lastMessageBody: string;
  lastMessageAt: string;
  hasUnreadFromStaff: boolean;
}

export interface SupportMessageRow {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_staff: boolean;
  body: string;
  created_at: string;
}

export async function getOrCreateSupportTicket(userId: string): Promise<SupportTicketSummary> {
  const { data: existing, error: findErr } = await supabase
    .from('support_tickets')
    .select('id, subject, status, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) throw findErr;

  let ticket = existing;
  if (!ticket) {
    const { data: created, error: insertErr } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        subject: THOUSE_SUPPORT_SUBJECT,
      })
      .select('id, subject, status, updated_at')
      .single();
    if (insertErr) throw insertErr;
    ticket = created;
  }

  const { data: msgs } = await supabase
    .from('support_messages')
    .select('body, is_staff, created_at')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const last = msgs?.[0];
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    updated_at: ticket.updated_at,
    lastMessageBody: last?.body ?? '',
    lastMessageAt: last?.created_at ?? ticket.updated_at,
    hasUnreadFromStaff: Boolean(last?.is_staff),
  };
}

export async function fetchSupportMessages(ticketId: string): Promise<SupportMessageRow[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, ticket_id, sender_id, is_staff, body, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupportMessageRow[];
}

export async function sendSupportMessageAsUser(ticketId: string, userId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const { error } = await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: userId,
    is_staff: false,
    body: trimmed,
  });

  if (error) throw error;
}
