import type { Property } from '../App';
import { shouldShowPasswordRecoveryScreen } from './passwordRecovery';

export type AppScreen =
  | 'home'
  | 'auth-tenant'
  | 'auth-landlord'
  | 'forgot-password'
  | 'property'
  | 'landlord-dashboard'
  | 'chat'
  | 'reset-password'
  | 'profile'
  | 'profile-edit'
  | 'my-properties'
  | 'lease-applications';

export const PERSISTABLE_SCREENS = new Set<AppScreen>([
  'home',
  'property',
  'landlord-dashboard',
  'chat',
  'profile',
  'my-properties',
  'lease-applications',
]);

const NAV_STORAGE_KEY = 'thouse_app_nav';
const BACK_GUARD_SESSION_KEY = 'thouse_back_guard_installed';

export type StoredNav = {
  screen: AppScreen;
  propertyId: string | null;
  property: Property | null;
};

function isAppScreen(value: string): value is AppScreen {
  return (
    value === 'home' ||
    value === 'auth-tenant' ||
    value === 'auth-landlord' ||
    value === 'forgot-password' ||
    value === 'property' ||
    value === 'landlord-dashboard' ||
    value === 'chat' ||
    value === 'reset-password' ||
    value === 'profile' ||
    value === 'profile-edit' ||
    value === 'my-properties' ||
    value === 'lease-applications'
  );
}

function isAuthCallbackHash(hash: string): boolean {
  const raw = hash.replace(/^#/, '');
  if (!raw || raw.startsWith('/')) return false;
  return (
    raw.includes('access_token=') ||
    raw.includes('refresh_token=') ||
    raw.includes('error=') ||
    raw.includes('error_description=') ||
    raw.startsWith('type=') ||
    raw.includes('code=') ||
    raw.includes('token_hash=')
  );
}

function screenFromRoute(route: string, propertyId?: string): StoredNav | null {
  switch (route) {
    case '':
    case 'home':
      return { screen: 'home', propertyId: null, property: null };
    case 'property':
      return propertyId
        ? { screen: 'property', propertyId, property: null }
        : { screen: 'home', propertyId: null, property: null };
    case 'chat':
      return { screen: 'chat', propertyId: null, property: null };
    case 'profile':
      return { screen: 'profile', propertyId: null, property: null };
    case 'my-properties':
      return { screen: 'my-properties', propertyId: null, property: null };
    case 'lease-applications':
      return { screen: 'lease-applications', propertyId: null, property: null };
    case 'landlord-dashboard':
      return { screen: 'landlord-dashboard', propertyId: null, property: null };
    default:
      return null;
  }
}

export function parseAppHash(): StoredNav | null {
  const hash = window.location.hash;
  if (isAuthCallbackHash(hash)) return null;

  if (!hash || hash === '#' || hash === '#/') {
    return { screen: 'home', propertyId: null, property: null };
  }

  const path = hash.replace(/^#\/?/, '');
  if (!path) {
    return { screen: 'home', propertyId: null, property: null };
  }

  const [route, ...rest] = path.split('/').filter(Boolean);
  return screenFromRoute(route, rest[0]);
}

export function screenToHash(screen: AppScreen, propertyId?: string | null): string {
  switch (screen) {
    case 'property':
      return propertyId ? `#/property/${propertyId}` : '#/';
    case 'chat':
      return '#/chat';
    case 'profile':
      return '#/profile';
    case 'my-properties':
      return '#/my-properties';
    case 'lease-applications':
      return '#/lease-applications';
    case 'landlord-dashboard':
      return '#/landlord-dashboard';
    default:
      return '#/';
  }
}

function navUrl(screen: AppScreen, propertyId?: string | null): string {
  return `${window.location.pathname || '/'}${screenToHash(screen, propertyId)}`;
}

function readStorage(): StoredNav | null {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const raw = storage.getItem(NAV_STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        screen?: string;
        propertyId?: string | null;
        property?: Property | null;
      };
      const screen = parsed.screen && isAppScreen(parsed.screen) ? parsed.screen : null;
      if (!screen || !PERSISTABLE_SCREENS.has(screen)) continue;

      const propertyId =
        typeof parsed.propertyId === 'string'
          ? parsed.propertyId
          : parsed.property && typeof parsed.property.id === 'string'
            ? parsed.property.id
            : null;

      const property =
        screen === 'property' &&
        parsed.property &&
        typeof parsed.property.id === 'string' &&
        parsed.property.id === propertyId
          ? parsed.property
          : null;

      if (screen === 'property' && !propertyId) continue;

      return { screen, propertyId, property };
    } catch {
      // try next storage
    }
  }
  return null;
}

export type ReadAppNavOptions = {
  /** 僅用於冷啟動：URL 為首頁但 storage 有更深層畫面時，優先還原 storage（常見於行動端分頁還原遺失 hash） */
  preferStorageOverGenericHome?: boolean;
};

export function readAppNav(options?: ReadAppNavOptions): StoredNav {
  if (shouldShowPasswordRecoveryScreen()) {
    return { screen: 'reset-password', propertyId: null, property: null };
  }

  if (isAuthCallbackHash(window.location.hash)) {
    const fromStorage = readStorage();
    return fromStorage ?? { screen: 'home', propertyId: null, property: null };
  }

  const fromHash = parseAppHash();
  const fromStorage = readStorage();

  if (fromHash && fromHash.screen !== 'home') {
    return fromHash;
  }

  if (
    options?.preferStorageOverGenericHome &&
    fromStorage &&
    fromStorage.screen !== 'home'
  ) {
    return fromStorage;
  }

  if (fromHash) return fromHash;

  if (fromStorage) return fromStorage;

  return { screen: 'home', propertyId: null, property: null };
}

/** 只寫入 storage（不動瀏覽器 history） */
export function persistAppNav(screen: AppScreen, property: Property | null) {
  if (!PERSISTABLE_SCREENS.has(screen)) return;

  const payload = {
    screen,
    propertyId: screen === 'property' ? property?.id ?? null : null,
    property: screen === 'property' ? property : null,
  };

  const serialized = JSON.stringify(payload);
  try {
    sessionStorage.setItem(NAV_STORAGE_KEY, serialized);
    localStorage.setItem(NAV_STORAGE_KEY, serialized);
  } catch {
    // ignore quota / private mode
  }
}

/** 前進導航：push history，支援瀏覽器上一頁／下一頁 */
export function pushAppNavHistory(screen: AppScreen, property: Property | null) {
  if (!PERSISTABLE_SCREENS.has(screen)) return;
  if (isAuthCallbackHash(window.location.hash)) return;

  persistAppNav(screen, property);

  const propertyId = screen === 'property' ? property?.id ?? null : null;
  const nextUrl = navUrl(screen, propertyId);
  const currentUrl = `${window.location.pathname || '/'}${window.location.hash || ''}`;

  if (currentUrl !== nextUrl) {
    window.history.pushState(
      { thouseScreen: screen, thousePropertyId: propertyId },
      '',
      nextUrl,
    );
  }
}

/** 初始同步 URL（不新增 history 條目） */
export function replaceAppNavHistory(screen: AppScreen, property: Property | null) {
  if (!PERSISTABLE_SCREENS.has(screen)) return;
  if (isAuthCallbackHash(window.location.hash)) return;

  persistAppNav(screen, property);

  const propertyId = screen === 'property' ? property?.id ?? null : null;
  const nextUrl = navUrl(screen, propertyId);
  const currentUrl = `${window.location.pathname || '/'}${window.location.hash || ''}`;

  if (currentUrl !== nextUrl) {
    window.history.replaceState(
      { thouseScreen: screen, thousePropertyId: propertyId },
      '',
      nextUrl,
    );
  }
}

/** 同步目前畫面到 history.state（URL 相同時仍會更新，供登入頁返回首頁） */
export function syncHistoryState(screen: AppScreen, property: Property | null = null) {
  if (isAuthCallbackHash(window.location.hash)) return;

  const propertyId = screen === 'property' ? property?.id ?? null : null;
  if (PERSISTABLE_SCREENS.has(screen)) {
    persistAppNav(screen, property);
  }

  window.history.replaceState(
    { thouseScreen: screen, thousePropertyId: propertyId },
    '',
    navUrl(screen, propertyId),
  );
}

/** 進入登入／註冊頁：push history，讓瀏覽器返回與站內返回皆能回到上一畫面 */
export function pushAuthNavHistory(screen: 'auth-tenant' | 'auth-landlord') {
  if (isAuthCallbackHash(window.location.hash)) return;

  const url = `${window.location.pathname || '/'}${window.location.hash || '#/'}`
  window.history.pushState({ thouseScreen: screen, thousePropertyId: null }, '', url);
}

function navFromHistoryState(state: unknown): StoredNav | null {
  if (!state || typeof state !== 'object' || !('thouseScreen' in state)) return null;
  const screen = (state as { thouseScreen?: unknown }).thouseScreen;
  if (screen === 'auth-tenant' || screen === 'auth-landlord') {
    return { screen, propertyId: null, property: null };
  }
  return null;
}

export function goBackInHistory(fallback?: () => void) {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  fallback?.();
}

/**
 * 首次進站時補一層 history，避免手機第一次按返回就直接離開網站。
 * 若使用者是從其他頁面點進來（history.length > 1），則不插入。
 */
export function installBackExitGuardIfNeeded(): void {
  if (shouldShowPasswordRecoveryScreen()) return;
  if (isAuthCallbackHash(window.location.hash)) return;

  try {
    if (sessionStorage.getItem(BACK_GUARD_SESSION_KEY)) return;
  } catch {
    // ignore private mode
  }

  if (window.history.length > 1) return;

  window.history.pushState({ thouseExitGuard: true }, '', window.location.href);

  try {
    sessionStorage.setItem(BACK_GUARD_SESSION_KEY, '1');
  } catch {
    // ignore private mode
  }
}

export function syncNavFromUrl(onRestore: (nav: StoredNav) => void): () => void {
  const restore = () => {
    if (shouldShowPasswordRecoveryScreen() || isAuthCallbackHash(window.location.hash)) return;
    const nav = readAppNav();
    onRestore(nav);
  };

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) restore();
  };

  const onHashChange = () => restore();
  const onPopState = (event: PopStateEvent) => {
    if (shouldShowPasswordRecoveryScreen() || isAuthCallbackHash(window.location.hash)) return;
    const fromState = navFromHistoryState(event.state);
    if (fromState) {
      onRestore(fromState);
      return;
    }
    restore();
  };

  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('popstate', onPopState);

  return () => {
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('popstate', onPopState);
  };
}
