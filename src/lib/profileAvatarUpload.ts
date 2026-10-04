import { supabase } from './supabase';

const BUCKET = 'profile-avatars';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

function extFromName(filename: string, mime: string) {
  const fromName = filename.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

function isAllowedImageType(type: string) {
  return ALLOWED_TYPES.has(type) || type.startsWith('image/');
}

export function validateAvatarFile(file: File): string | null {
  if (!isAllowedImageType(file.type)) {
    return 'INVALID_TYPE';
  }
  if (file.size > MAX_BYTES) {
    return 'TOO_LARGE';
  }
  return null;
}

/** 裁剪前的原始檔（手機拍照常超過 5MB）。 */
export function validateAvatarSourceFile(file: File): string | null {
  if (!isAllowedImageType(file.type)) {
    return 'INVALID_TYPE';
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return 'TOO_LARGE';
  }
  return null;
}

function tryExtractAvatarPath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0] || '');
}

/**
 * 上傳個人頭像至公開 bucket，回傳 public URL；可選刪除舊檔。
 */
export async function uploadProfileAvatar(
  userId: string,
  file: File,
  previousAvatarUrl?: string | null,
): Promise<string> {
  const invalid = validateAvatarFile(file);
  if (invalid === 'INVALID_TYPE') {
    throw new Error('INVALID_TYPE');
  }
  if (invalid === 'TOO_LARGE') {
    throw new Error('TOO_LARGE');
  }

  const ext = extFromName(file.name, file.type);
  const path = `${userId}/avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });

  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('not found') || m.includes('bucket')) {
      throw new Error('BUCKET_MISSING');
    }
    if (m.includes('row-level security') || m.includes('rls')) {
      throw new Error('RLS');
    }
    throw new Error(error.message || 'UPLOAD_FAILED');
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  if (previousAvatarUrl) {
    const oldPath = tryExtractAvatarPath(previousAvatarUrl);
    if (oldPath && oldPath !== path) {
      void supabase.storage.from(BUCKET).remove([oldPath]);
    }
  }

  return publicUrl;
}

export async function updateOwnAvatarUrl(avatarUrl: string | null): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('NOT_SIGNED_IN');
  }

  const nextUrl = avatarUrl?.trim() ? avatarUrl.trim() : '';
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: nextUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    throw new Error(error.message || 'UPDATE_FAILED');
  }
}

/**
 * 清除個人頭像（DB + Storage）。
 */
export async function removeProfileAvatar(previousAvatarUrl?: string | null): Promise<void> {
  await updateOwnAvatarUrl(null);

  if (previousAvatarUrl) {
    const oldPath = tryExtractAvatarPath(previousAvatarUrl);
    if (oldPath) {
      void supabase.storage.from(BUCKET).remove([oldPath]);
    }
  }
}
