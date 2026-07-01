import { useState } from 'react';
import { FileText, Languages, Loader2 } from 'lucide-react';
import { parseChatMessageBody } from '../../lib/chatMessageBody';
import { translateTextForLocale } from '../../lib/translateText';
import { useLocale } from '../../context/LocaleContext';
import { cn } from '../ui/utils';

type ChatMessageContentProps = {
  body: string;
  isMe?: boolean;
  className?: string;
};

export function ChatMessageContent({ body, isMe, className }: ChatMessageContentProps) {
  const { locale, chatT } = useLocale();
  const { attachment, text } = parseChatMessageBody(body);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');

  const translateTarget = text.trim() || attachment?.name || '';

  const handleTranslate = async () => {
    if (!translateTarget) return;
    if (translation) {
      setTranslation(null);
      return;
    }
    setTranslating(true);
    setTranslateError('');
    try {
      const result = await translateTextForLocale(translateTarget, locale);
      setTranslation(result);
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : chatT.translateFailed);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {attachment ? (
        <div className="overflow-hidden rounded-lg border border-stone-200/80 bg-white/80">
          {attachment.kind === 'image' ? (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-h-56 w-full object-cover sm:max-h-64"
              />
            </a>
          ) : attachment.kind === 'video' ? (
            <video src={attachment.url} controls className="max-h-56 w-full bg-black sm:max-h-64" preload="metadata">
              <track kind="captions" />
            </video>
          ) : (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-stone-800 hover:bg-stone-50"
            >
              <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 truncate underline-offset-2 hover:underline">{attachment.name}</span>
            </a>
          )}
        </div>
      ) : null}

      {text.trim() ? <p className="whitespace-pre-wrap break-words">{text}</p> : null}

      {translation ? (
        <p className="whitespace-pre-wrap break-words border-t border-stone-300/40 pt-2 text-stone-600 italic">
          {translation}
        </p>
      ) : null}

      {translateError ? <p className="text-xs text-red-600">{translateError}</p> : null}

      {translateTarget ? (
        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={translating}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium transition-colors',
            isMe ? 'text-slate-600 hover:text-slate-900' : 'text-stone-500 hover:text-stone-800'
          )}
        >
          {translating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Languages className="h-3 w-3" strokeWidth={1.75} />
          )}
          {translation ? chatT.showOriginal : chatT.translate}
        </button>
      ) : null}
    </div>
  );
}
