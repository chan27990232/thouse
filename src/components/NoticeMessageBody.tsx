import { FileText, Film, ImageIcon } from 'lucide-react';
import { parseChatMessageBody } from '../lib/chatMessageBody';

interface NoticeMessageBodyProps {
  body: string;
}

export function NoticeMessageBody({ body }: NoticeMessageBodyProps) {
  const { attachment, text } = parseChatMessageBody(body);
  const trimmedText = text.trim();

  return (
    <div className="min-w-0 space-y-2">
      {attachment ? (
        attachment.kind === 'image' ? (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-md border border-gray-200 bg-white"
          >
            <img
              src={attachment.url}
              alt={attachment.name}
              className="max-h-32 w-full object-cover"
            />
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
              {attachment.kind === 'video' ? '查看影片' : attachment.name}
            </span>
          </a>
        )
      ) : null}

      {trimmedText ? (
        <p className="break-words whitespace-pre-wrap text-gray-800">{trimmedText}</p>
      ) : null}

      {!attachment && !trimmedText ? (
        body.includes('[thouse-attachment]') ? (
          <p className="text-xs text-gray-600">傳送了附件</p>
        ) : (
          <p className="text-xs text-gray-500 italic">（空白訊息）</p>
        )
      ) : null}
    </div>
  );
}

/** 收件匣列表等僅需一行摘要時使用 */
export function NoticeMessagePreviewLine({ body }: { body: string }) {
  const { attachment, text } = parseChatMessageBody(body);
  const line = text.trim().split('\n').find((l) => l.trim())?.trim();

  if (line) {
    return <span className="break-words">{line.length > 100 ? `${line.slice(0, 100)}…` : line}</span>;
  }

  if (!attachment) return <span className="text-gray-500">（空白訊息）</span>;

  if (attachment.kind === 'image') {
    return (
      <span className="inline-flex items-center gap-1 text-gray-700">
        <ImageIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        傳送了圖片
      </span>
    );
  }
  if (attachment.kind === 'video') {
    return (
      <span className="inline-flex items-center gap-1 text-gray-700">
        <Film className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        傳送了影片
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-gray-700">
      <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">傳送了檔案：{attachment.name}</span>
    </span>
  );
}
