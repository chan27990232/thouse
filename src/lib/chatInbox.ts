export const CHAT_SETTINGS_STORAGE_KEY = 'thouse_chat_settings';

export type ChatSettings = {
  showArchived: boolean;
};

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  showArchived: false,
};

export function readChatSettings(): ChatSettings {
  if (typeof window === 'undefined') return DEFAULT_CHAT_SETTINGS;
  try {
    const raw = localStorage.getItem(CHAT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CHAT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ChatSettings>;
    return { ...DEFAULT_CHAT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_CHAT_SETTINGS;
  }
}

export function writeChatSettings(settings: ChatSettings) {
  localStorage.setItem(CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function archivedStorageKey(userId: string) {
  return `thouse_chat_archived_${userId}`;
}

export function readArchivedConversationIds(userId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(archivedStorageKey(userId));
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

export function writeArchivedConversationIds(userId: string, ids: Set<string>) {
  localStorage.setItem(archivedStorageKey(userId), JSON.stringify([...ids]));
}

export function archiveConversationLocal(userId: string, conversationId: string) {
  const ids = readArchivedConversationIds(userId);
  ids.add(conversationId);
  writeArchivedConversationIds(userId, ids);
}

export function unarchiveConversationLocal(userId: string, conversationId: string) {
  const ids = readArchivedConversationIds(userId);
  ids.delete(conversationId);
  writeArchivedConversationIds(userId, ids);
}

export function isConversationArchived(userId: string, conversationId: string) {
  return readArchivedConversationIds(userId).has(conversationId);
}
