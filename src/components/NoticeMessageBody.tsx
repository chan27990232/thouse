import { FileText, Film, ImageIcon } from 'lucide-react';
import { parseChatMessageBody } from '../lib/chatMessageBody';
import { useLocale } from '../context/LocaleContext';
import { classifyNoticeKind, type AppNoticeKind } from '../lib/leaseNotice';
import type { NoticeMessages } from '../content/translations/notice';

function kindBody(kind: AppNoticeKind, noticeT: NoticeMessages): string | null {
  switch (kind) {
    case 'viewing':
      return noticeT.bodyViewing;
    case 'viewingSuccess':
      return noticeT.bodyViewingSuccess;
    case 'viewingIgnored':
      return noticeT.bodyViewingIgnored;
    case 'leaseOffer':
      return noticeT.bodyLeaseOffer;
    case 'leaseSubmitted':
      return noticeT.bodyLeaseSubmitted;
    case 'leaseLandlordAccepted':
      return noticeT.bodyLeaseLandlordAccepted;
    case 'leaseRejected':
      return noticeT.bodyLeaseRejected;
    default:
      return null;
  }
}

export function noticeKindLabel(kind: AppNoticeKind, noticeT: NoticeMessages): string {
  switch (kind) {
    case 'viewing':
      return noticeT.kindViewing;
    case 'viewingSuccess':
      return noticeT.kindViewingSuccess;
    case 'viewingIgnored':
      return noticeT.kindViewingIgnored;
    case 'leaseOffer':
      return noticeT.kindLeaseOffer;
    case 'leaseSubmitted':
      return noticeT.kindLeaseSubmitted;
    case 'leaseLandlordAccepted':
      return noticeT.kindLeaseLandlordAccepted;
    case 'leaseRejected':
      return noticeT.kindLeaseRejected;
    default:
      return noticeT.kindMessage;
  }
}

export function NoticeMessageBody({ body }: { body: string }) {
  const { noticeT, chatT } = useLocale();
  if ((body ?? '').trim() === '[thouse-deleted]') {
    return <p className="text-sm italic text-gray-500">{chatT.messageDeleted}</p>;
  }
  const kind = classifyNoticeKind(body);
  const actionCopy = kindBody(kind, noticeT);
  const { attachment, text } = parseChatMessageBody(body);
  const trimmedText = text.trim();
  const showRawText = kind === 'message' || kind === 'viewing' || kind === 'viewingSuccess' || kind === 'viewingIgnored';

  return (
    <div className="min-w-0 space-y-2">
      {actionCopy ? <p className="text-sm text-gray-800">{actionCopy}</p> : null}

      {attachment ? (
        attachment.kind === 'image' ? (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-md border border-gray-200 bg-white"
          >
            <img src={attachment.url} alt={attachment.name} className="max-h-32 w-full object-cover" />
          </a>
        ) : (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-sky-800 hover:bg-sky-50"
          >
            {attachment.kind === 'video' ? (
              <Film className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            )}
            <span className="min-w-0 truncate">
              {attachment.kind === 'video' ? noticeT.viewVideo : attachment.name}
            </span>
          </a>
        )
      ) : null}

      {showRawText && trimmedText ? (
        <p className="break-words whitespace-pre-wrap text-gray-800">{trimmedText}</p>
      ) : null}

      {kind === 'message' && !attachment && !trimmedText ? (
        body.includes('[thouse-attachment]') ? (
          <p className="text-xs text-gray-600">{noticeT.sentAttachment}</p>
        ) : (
          <p className="text-xs text-gray-500 italic">{noticeT.emptyMessage}</p>
        )
      ) : null}
    </div>
  );
}

/** 收件匣列表等僅需一行摘要時使用 */
export function NoticeMessagePreviewLine({ body }: { body: string }) {
  const { noticeT } = useLocale();
  const kind = classifyNoticeKind(body);
  const actionCopy = kindBody(kind, noticeT);
  if (actionCopy) return <span className="break-words">{actionCopy}</span>;

  const { attachment, text } = parseChatMessageBody(body);
  const line = text.trim().split('\n').find((l) => l.trim())?.trim();

  if (line) {
    return <span className="break-words">{line.length > 100 ? `${line.slice(0, 100)}…` : line}</span>;
  }

  if (!attachment) return <span className="text-gray-500">{noticeT.emptyMessage}</span>;

  if (attachment.kind === 'image') {
    return (
      <span className="inline-flex items-center gap-1 text-gray-700">
        <ImageIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        {noticeT.sentImage}
      </span>
    );
  }
  if (attachment.kind === 'video') {
    return (
      <span className="inline-flex items-center gap-1 text-gray-700">
        <Film className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        {noticeT.sentVideo}
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-gray-700">
      <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{noticeT.format('sentFile', { name: attachment.name })}</span>
    </span>
  );
}
