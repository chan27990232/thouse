import { useLocale } from '../../context/LocaleContext';
import { cn } from '../ui/utils';

type ChatDeletedPlaceholderProps = {
  isMe?: boolean;
  className?: string;
};

export function ChatDeletedPlaceholder({ isMe, className }: ChatDeletedPlaceholderProps) {
  const { chatT } = useLocale();
  return (
    <p
      className={cn(
        'text-sm italic leading-relaxed',
        isMe ? 'text-slate-500' : 'text-stone-400',
        className,
      )}
    >
      {chatT.messageDeleted}
    </p>
  );
}
