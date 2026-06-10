import { supabase } from './supabase';

export const LEASE_MGMT_MAX_FILES = 10;
export const LEASE_MGMT_MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024; // 10GB

const BUCKET = 'lease-management-requests';

export interface LeaseManagementRequestFileRecord {
  id: string;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string | null;
  createdAt: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function validateLeaseManagementFiles(files: File[]): void {
  if (files.length > LEASE_MGMT_MAX_FILES) {
    throw new Error(`最多上傳 ${LEASE_MGMT_MAX_FILES} 個檔案`);
  }
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > LEASE_MGMT_MAX_TOTAL_BYTES) {
    throw new Error('附件總大小不可超過 10GB');
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_').slice(0, 120) || 'file';
}

export async function uploadLeaseManagementRequestFiles(
  landlordId: string,
  requestId: string,
  files: File[]
): Promise<LeaseManagementRequestFileRecord[]> {
  if (files.length === 0) return [];
  validateLeaseManagementFiles(files);

  const uploaded: { file_name: string; storage_path: string; file_size_bytes: number; mime_type: string }[] = [];
  const paths: string[] = [];

  try {
    for (const file of files) {
      const safeName = sanitizeFileName(file.name);
      const path = `${landlordId}/${requestId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('bucket') || m.includes('not found')) {
          throw new Error('請在 Supabase 執行 lease_management_request_files.sql 建立儲存空間');
        }
        throw new Error(`上傳「${file.name}」失敗：${error.message}`);
      }
      paths.push(path);
      uploaded.push({
        file_name: file.name,
        storage_path: path,
        file_size_bytes: file.size,
        mime_type: file.type || '',
      });
    }

    const { error: regErr } = await supabase.rpc('register_lease_management_request_files', {
      p_request_id: requestId,
      p_files: uploaded,
    });
    if (regErr) throw new Error(regErr.message || '無法登記附件');

    return uploaded.map((u, i) => ({
      id: paths[i],
      fileName: u.file_name,
      storagePath: u.storage_path,
      fileSizeBytes: u.file_size_bytes,
      mimeType: u.mime_type || null,
      createdAt: new Date().toISOString(),
    }));
  } catch (e) {
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
    throw e;
  }
}

export async function fetchLeaseManagementRequestFiles(
  requestId: string
): Promise<LeaseManagementRequestFileRecord[]> {
  const { data, error } = await supabase
    .from('lease_management_request_files')
    .select('id, file_name, storage_path, file_size_bytes, mime_type, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.message.includes('lease_management_request_files')) return [];
    throw new Error(error.message || '無法載入附件');
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    fileName: row.file_name as string,
    storagePath: row.storage_path as string,
    fileSizeBytes: Number(row.file_size_bytes),
    mimeType: (row.mime_type as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function getLeaseManagementFileSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) throw new Error(error?.message || '無法取得下載連結');
  return data.signedUrl;
}
