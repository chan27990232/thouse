import type { UserRole } from '../App';

export const AUTH_ROLE_STORAGE_KEY = 'thouse-auth-role';

export function getStoredAuthRole(): UserRole {
  const role = localStorage.getItem(AUTH_ROLE_STORAGE_KEY);
  return role === 'tenant' || role === 'landlord' ? role : 'tenant';
}

export function getRoleFromMetadata(metadata: unknown): UserRole {
  if (metadata && typeof metadata === 'object' && 'role' in metadata) {
    const role = (metadata as { role?: unknown }).role;
    return role === 'tenant' || role === 'landlord' ? role : null;
  }
  return null;
}

export function getUsernameFromMetadata(metadata: unknown): string {
  if (metadata && typeof metadata === 'object' && 'username' in metadata) {
    const username = (metadata as { username?: unknown }).username;
    return typeof username === 'string' ? username : '';
  }
  return '';
}

export function getSalutationFromMetadata(metadata: unknown): '' | '先生' | '女士' {
  if (metadata && typeof metadata === 'object' && 'salutation' in metadata) {
    const salutation = (metadata as { salutation?: unknown }).salutation;
    return salutation === '先生' || salutation === '女士' ? salutation : '';
  }
  return '';
}

export function getPhoneFromMetadata(metadata: unknown): string {
  if (metadata && typeof metadata === 'object' && 'phone' in metadata) {
    const phone = (metadata as { phone?: unknown }).phone;
    return typeof phone === 'string' ? phone : '';
  }
  return '';
}
