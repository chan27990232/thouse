import { useRef, type ChangeEvent } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import { useLocale } from '../../context/LocaleContext';

interface LocalizedFileInputProps {
  id?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'dashed';
  onFiles: (files: File[]) => void;
  /** When false, hides the “no file chosen” hint (e.g. parent already lists selected files). */
  showEmptyHint?: boolean;
}

export function LocalizedFileInput({
  id,
  accept,
  multiple = false,
  disabled = false,
  className,
  variant = 'default',
  onFiles,
  showEmptyHint = true,
}: LocalizedFileInputProps) {
  const { commonT } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFiles(files);
    }
    e.target.value = '';
  };

  const label = multiple ? commonT.chooseFiles : commonT.chooseFile;

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant={variant === 'dashed' ? 'outline' : 'outline'}
        size="sm"
        disabled={disabled}
        className={cn(
          'h-9 w-full gap-2 text-sm',
          variant === 'dashed' && 'border-dashed bg-transparent'
        )}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp className="h-4 w-4 shrink-0" />
        {label}
      </Button>
      {showEmptyHint ? <p className="mt-1.5 text-xs text-gray-500">{commonT.noFileChosen}</p> : null}
    </div>
  );
}
