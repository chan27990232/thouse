import { useRef } from 'react';
import { FileUp, X } from 'lucide-react';
import { Label } from './ui/label';
import { Button } from './ui/button';
import {
  formatFileSize,
  LEASE_MGMT_MAX_FILES,
  LEASE_MGMT_MAX_TOTAL_BYTES,
  validateLeaseManagementFiles,
} from '../lib/leaseManagementRequestFiles';

interface LeaseManagementFileUploadProps {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export function LeaseManagementFileUpload({ id, files, onChange, disabled }: LeaseManagementFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length || disabled) return;
    const merged = [...files, ...Array.from(incoming)];
    try {
      validateLeaseManagementFiles(merged);
      onChange(merged);
    } catch (e) {
      alert(e instanceof Error ? e.message : '無法加入檔案');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium text-gray-700">
          證明文件（選填）
        </Label>
        <span className="text-[11px] text-gray-500">
          {files.length}/{LEASE_MGMT_MAX_FILES} 個 · {formatFileSize(totalBytes)} /{' '}
          {formatFileSize(LEASE_MGMT_MAX_TOTAL_BYTES)}
        </span>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        className="sr-only"
        disabled={disabled || files.length >= LEASE_MGMT_MAX_FILES}
        onChange={(e) => addFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full gap-2 text-sm"
        disabled={disabled || files.length >= LEASE_MGMT_MAX_FILES}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp className="h-4 w-4" />
        選擇檔案
      </Button>
      {files.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs"
            >
              <span className="min-w-0 truncate" title={f.name}>
                {f.name}{' '}
                <span className="text-gray-500">({formatFileSize(f.size)})</span>
              </span>
              {!disabled ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  aria-label={`移除 ${f.name}`}
                  onClick={() => removeAt(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          可上傳合約、對話紀錄、照片等，最多 {LEASE_MGMT_MAX_FILES} 個檔案，總計 10GB 以內。
        </p>
      )}
    </div>
  );
}
