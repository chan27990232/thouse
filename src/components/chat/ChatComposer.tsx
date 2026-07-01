import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Plus, Send, Video, X } from 'lucide-react';
import { Input } from '../ui/input';
import { uploadChatAttachment, validateChatAttachmentFile } from '../../lib/chatAttachments';
import type { ParsedChatAttachment } from '../../lib/chatMessageBody';
import { cn } from '../ui/utils';
import { useLocale } from '../../context/LocaleContext';

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (payload: { text: string; attachment: ParsedChatAttachment | null }) => Promise<void>;
  placeholder: string;
  userId: string;
  disabled?: boolean;
};

const ATTACH_MENU_ITEM_IDS = ['document', 'media', 'camera'] as const;

const ATTACH_MENU_META: Record<
  (typeof ATTACH_MENU_ITEM_IDS)[number],
  { icon: typeof FileText; iconClass: string; labelKey: 'attachFile' | 'attachPhotoVideo' | 'attachCamera' }
> = {
  document: { icon: FileText, iconClass: 'bg-[#7f66ff]', labelKey: 'attachFile' },
  media: { icon: ImageIcon, iconClass: 'bg-[#007bfc]', labelKey: 'attachPhotoVideo' },
  camera: { icon: Camera, iconClass: 'bg-[#ff2e74]', labelKey: 'attachCamera' },
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  userId,
  disabled,
}: ChatComposerProps) {
  const { chatT } = useLocale();
  const menuRef = useRef<HTMLDivElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [menuOpen]);

  const clearPending = () => {
    setPendingFile(null);
    setError('');
    if (documentInputRef.current) documentInputRef.current.value = '';
    if (mediaInputRef.current) mediaInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFilePick = (file: File | null) => {
    if (!file) return;
    const validationError = validateChatAttachmentFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPendingFile(file);
    setError('');
    setMenuOpen(false);
  };

  const submit = async () => {
    const text = value.trim();
    if (!text && !pendingFile) return;
    if (uploading || disabled) return;

    setUploading(true);
    setError('');
    try {
      let attachment: ParsedChatAttachment | null = null;
      if (pendingFile) {
        attachment = await uploadChatAttachment(userId, pendingFile);
      }
      await onSend({ text, attachment });
      onChange('');
      clearPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : chatT.sendFailed);
    } finally {
      setUploading(false);
    }
  };

  const pendingKind = pendingFile
    ? pendingFile.type.startsWith('video/')
      ? 'video'
      : pendingFile.type.startsWith('image/')
        ? 'image'
        : 'file'
    : null;

  return (
    <div className="space-y-2">
      {pendingFile ? (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
          {pendingKind === 'image' ? (
            <ImageIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          ) : pendingKind === 'video' ? (
            <Video className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          ) : (
            <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          )}
          <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
          <button
            type="button"
            onClick={clearPending}
            className="rounded-full p-1 text-stone-500 hover:bg-stone-200/80"
            aria-label={chatT.removeAttachment}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex items-end gap-2 sm:gap-3">
        <div ref={menuRef} className="relative shrink-0">
          {menuOpen ? (
            <div
              className="absolute bottom-full left-0 z-30 mb-2 w-[min(100vw-2rem,15rem)] overflow-hidden rounded-2xl border border-stone-200/80 bg-white py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
              role="menu"
            >
              {ATTACH_MENU_ITEM_IDS.map((id) => {
                const item = ATTACH_MENU_META[id];
                const Icon = item.icon;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    disabled={uploading || disabled}
                    onClick={() => {
                      if (id === 'document') documentInputRef.current?.click();
                      else if (id === 'media') mediaInputRef.current?.click();
                      else cameraInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px] text-stone-800 transition-colors hover:bg-stone-50 disabled:opacity-50"
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white',
                        item.iconClass
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="font-normal">{chatT[item.labelKey]}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <input
            ref={documentInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,application/*"
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
          />
          <input
            ref={mediaInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*"
            multiple={false}
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={uploading || disabled}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:bg-stone-50 disabled:opacity-50',
              menuOpen && 'rotate-45 bg-stone-100'
            )}
            aria-label={menuOpen ? chatT.closeAttachMenu : chatT.addAttachment}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          disabled={uploading || disabled}
          className="min-h-10 flex-1 rounded-full border-stone-200 bg-white py-2.5 shadow-sm"
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={uploading || disabled || (!value.trim() && !pendingFile)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-gray-800 disabled:opacity-50"
          aria-label={chatT.send}
        >
          <Send className="h-4 w-4 shrink-0" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
