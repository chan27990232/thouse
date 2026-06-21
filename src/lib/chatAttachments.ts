import { supabase } from './supabase';
import type { ChatAttachmentKind, ParsedChatAttachment } from './chatMessageBody';

const BUCKET = 'chat-attachments';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function extFromName(filename: string, fallback: string) {
  const e = filename.split('.').pop();
  if (e && e.length <= 8) return e.toLowerCase();
  return fallback;
}

function kindForFile(file: File): ChatAttachmentKind {
  if (IMAGE_TYPES.has(file.type) || file.type.startsWith('image/')) return 'image';
  if (VIDEO_TYPES.has(file.type) || file.type.startsWith('video/')) return 'video';
  return 'file';
}

function maxBytesForKind(kind: ChatAttachmentKind): number {
  if (kind === 'image') return MAX_IMAGE_BYTES;
  if (kind === 'video') return MAX_VIDEO_BYTES;
  return MAX_FILE_BYTES;
}

export function validateChatAttachmentFile(file: File): string | null {
  const kind = kindForFile(file);
  const max = maxBytesForKind(kind);
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return kind === 'video'
      ? `影片大小不能超過 ${mb}MB`
      : kind === 'image'
        ? `圖片大小不能超過 ${mb}MB`
        : `檔案大小不能超過 ${mb}MB`;
  }
  return null;
}

export async function uploadChatAttachment(userId: string, file: File): Promise<ParsedChatAttachment> {
  const validationError = validateChatAttachmentFile(file);
  if (validationError) throw new Error(validationError);

  const kind = kindForFile(file);
  const ext = extFromName(file.name, kind === 'video' ? 'mp4' : kind === 'image' ? 'jpg' : 'bin');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    const m = (error.message || '').toLowerCase();
    const hint =
      m.includes('bucket') || m.includes('not found')
        ? ' 請在 Supabase 執行 supabase/chat_attachments_storage.sql 建立 chat-attachments bucket。'
        : m.includes('row-level security') || m.includes('rls')
          ? ' 請確認已套用 chat-attachments 的 Storage RLS 政策。'
          : '';
    throw new Error(`上傳附件失敗：${error.message}${hint}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, kind, name: file.name };
}
