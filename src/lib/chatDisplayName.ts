/** 聊天顯示：displayName(username)，例如 MrChan(Ken) */
export function formatChatUserLabel(displayName: string, username?: string | null): string {
  const name = displayName.trim();
  const uid = (username ?? '').trim();
  if (name && uid && name.toLowerCase() !== uid.toLowerCase()) {
    return `${name}(${uid})`;
  }
  if (name) return name;
  if (uid) return uid;
  return '';
}

export function buildLandlordChatDisplayName(fullName: string, salutation: string): string {
  const n = fullName.trim();
  const s = salutation === '先生' || salutation === '女士' ? salutation : '';
  const surname = n.split(/\s+/)[0] || '';
  return s ? `${surname} ${s}` : surname || n;
}

export interface PublicChatProfile {
  full_name: string;
  username: string;
  salutation: string;
  role: string;
}

export function buildChatPeerLabel(
  profile: PublicChatProfile | undefined,
  fallbackDisplay: string,
  fallbackRole: string,
): string {
  const roleFallback = fallbackDisplay.trim() || fallbackRole;
  if (!profile) {
    return roleFallback;
  }

  const display =
    profile.role === 'landlord'
      ? buildLandlordChatDisplayName(profile.full_name, profile.salutation)
      : profile.full_name.trim() || fallbackDisplay.trim();

  return formatChatUserLabel(display || roleFallback, profile.username) || roleFallback;
}
