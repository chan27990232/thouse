import { supabase } from './supabase';
import { uploadChatAttachment, validateChatAttachmentFile } from './chatAttachments';

export type ConversationLeaseOffer = {
  conversationId: string;
  propertyId: string;
  landlordId: string;
  tenantId: string;
  fileUrl: string;
  fileName: string;
  landlordFullName: string;
  landlordPhone: string;
  landlordEmail: string;
};

const SCHEMA_HINT =
  '請在 Supabase SQL Editor 執行 supabase/conversation_lease_offers.sql 後再試。';

function schemaError(error: { message?: string } | null): Error | null {
  const raw = (error?.message || '').toLowerCase();
  if (
    raw.includes('conversation_lease_offers') &&
    (raw.includes('schema cache') || raw.includes('does not exist') || raw.includes('could not find'))
  ) {
    return new Error(`資料庫尚未建立「對話租約」資料表。${SCHEMA_HINT}`);
  }
  return null;
}

export async function fetchLeaseOfferForConversation(
  conversationId: string,
): Promise<ConversationLeaseOffer | null> {
  const { data, error } = await supabase
    .from('conversation_lease_offers')
    .select(
      'conversation_id, property_id, landlord_id, tenant_id, file_url, file_name, landlord_full_name, landlord_phone, landlord_email',
    )
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    const mapped = schemaError(error);
    if (mapped) throw mapped;
    throw new Error(error.message || '無法載入租約');
  }
  if (!data) return null;

  return {
    conversationId: data.conversation_id,
    propertyId: data.property_id,
    landlordId: data.landlord_id,
    tenantId: data.tenant_id,
    fileUrl: data.file_url,
    fileName: data.file_name,
    landlordFullName: data.landlord_full_name ?? '',
    landlordPhone: data.landlord_phone ?? '',
    landlordEmail: data.landlord_email ?? '',
  };
}

export async function upsertConversationLeaseOffer(input: ConversationLeaseOffer): Promise<void> {
  const { error } = await supabase.from('conversation_lease_offers').upsert(
    {
      conversation_id: input.conversationId,
      property_id: input.propertyId,
      landlord_id: input.landlordId,
      tenant_id: input.tenantId,
      file_url: input.fileUrl,
      file_name: input.fileName,
      landlord_full_name: input.landlordFullName.trim(),
      landlord_phone: input.landlordPhone.trim(),
      landlord_email: input.landlordEmail.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id' },
  );

  if (error) {
    const mapped = schemaError(error);
    if (mapped) throw mapped;
    throw new Error(error.message || '無法儲存租約');
  }
}

export async function uploadLeaseOfferFile(userId: string, file: File) {
  const validationError = validateChatAttachmentFile(file);
  if (validationError) throw new Error(validationError);
  return uploadChatAttachment(userId, file);
}
