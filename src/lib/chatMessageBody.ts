import { parseViewingIgnoredPayload, parseViewingPayload, parseViewingSuccessPayload } from './viewingBookings';
import { parseLeaseNoticePayload } from './leaseNotice';

export type ChatAttachmentKind = 'image' | 'video' | 'file';

export type ParsedChatAttachment = {
  url: string;
  kind: ChatAttachmentKind;
  name: string;
};

const ATTACHMENT_RE = /^\[thouse-attachment\]([\s\S]*?)\[\/thouse-attachment\]\n?/;

export function parseChatMessageBody(body: string): {
  attachment: ParsedChatAttachment | null;
  text: string;
} {
  const afterViewing = parseViewingPayload(body).rest;
  const afterSuccess = parseViewingSuccessPayload(afterViewing).rest;
  const afterIgnored = parseViewingIgnoredPayload(afterSuccess).rest;
  const { rest } = parseLeaseNoticePayload(afterIgnored);
  const match = rest.match(ATTACHMENT_RE);
  if (!match) {
    return { attachment: null, text: rest };
  }
  try {
    const parsed = JSON.parse(match[1]!) as ParsedChatAttachment;
    if (parsed?.url && parsed?.kind && parsed?.name) {
      return { attachment: parsed, text: rest.slice(match[0].length) };
    }
  } catch {
    /* ignore */
  }
  return { attachment: null, text: rest };
}

export function buildChatMessageBody(attachment: ParsedChatAttachment | null, text: string): string {
  const trimmed = text.trim();
  if (!attachment) return trimmed;
  const block = `[thouse-attachment]${JSON.stringify(attachment)}[/thouse-attachment]`;
  return trimmed ? `${block}\n${trimmed}` : block;
}

export function getChatMessagePreview(body: string): string {
  if ((body ?? '').trim() === '[thouse-deleted]') return '[訊息已刪除]';
  const { attachment, text } = parseChatMessageBody(body);
  const line = text.split('\n').find((l) => l.trim())?.trim();
  if (line) return line.length > 80 ? `${line.slice(0, 80)}…` : line;
  if (attachment) {
    if (attachment.kind === 'image') return '[圖片]';
    if (attachment.kind === 'video') return '[影片]';
    return `[檔案] ${attachment.name}`;
  }
  if (body.includes('[thouse-attachment]')) return '[附件]';
  if (body.includes('[thouse-viewing-success]')) return '[預約成功]';
  if (body.includes('[thouse-viewing-ignored]')) return '[預約未獲接納]';
  if (body.includes('[thouse-viewing]')) return '[睇樓預約]';
  if (body.includes('[thouse-lease-notice]')) return '[簽約通知]';
  return '';
}
