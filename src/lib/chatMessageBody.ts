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
  const match = body.match(ATTACHMENT_RE);
  if (!match) {
    return { attachment: null, text: body };
  }
  try {
    const parsed = JSON.parse(match[1]!) as ParsedChatAttachment;
    if (parsed?.url && parsed?.kind && parsed?.name) {
      return { attachment: parsed, text: body.slice(match[0].length) };
    }
  } catch {
    /* ignore */
  }
  return { attachment: null, text: body };
}

export function buildChatMessageBody(attachment: ParsedChatAttachment | null, text: string): string {
  const trimmed = text.trim();
  if (!attachment) return trimmed;
  const block = `[thouse-attachment]${JSON.stringify(attachment)}[/thouse-attachment]`;
  return trimmed ? `${block}\n${trimmed}` : block;
}

export function getChatMessagePreview(body: string): string {
  const { attachment, text } = parseChatMessageBody(body);
  const line = text.split('\n').find((l) => l.trim())?.trim();
  if (line) return line.length > 80 ? `${line.slice(0, 80)}…` : line;
  if (attachment) {
    if (attachment.kind === 'image') return '[圖片]';
    if (attachment.kind === 'video') return '[影片]';
    return `[檔案] ${attachment.name}`;
  }
  if (body.includes('[thouse-attachment]')) return '[附件]';
  return '';
}
