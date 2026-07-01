import type { Property } from '../App';
import { shouldShowPasswordRecoveryScreen } from './passwordRecovery';

export type AppScreen =
  | 'home'
  | 'auth-tenant'
  | 'auth-landlord'
  | 'property'
  | 'landlord-dashboard'
  | 'chat'
  | 'reset-password'
  | 'profile'
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
    value === 'property' ||
    value === 'landlord-dashboard' ||
    value === 'chat' ||
    value === 'reset-password' ||
    value === 'profile' ||
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

export function readAppNav(): StoredNav {
  if (shouldShowPasswordRecoveryScreen()) {
    return { screen: 'reset-password', propertyId: null, property: null };
  }

  const fromHash = parseAppHash();
  if (fromHash) return fromHash;

  const fromStorage = readStorage();
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

export function goBackInHistory(fallback?: () => void) {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  fallback?.();
}

export function syncNavFromUrl(onRestore: (nav: StoredNav) => void): () => void {
  const restore = () => {
    if (shouldShowPasswordRecoveryScreen() || isAuthCallbackHash(window.location.hash)) return;
    const nav = readAppNav();
    onRestore(nav);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      return;
    }
    restore();
  };

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) restore();
  };

  const onHashChange = () => restore();
  const onPopState = () => restore();

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('popstate', onPopState);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('popstate', onPopState);
  };
}
