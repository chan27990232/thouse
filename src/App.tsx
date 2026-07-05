import { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { Home } from './components/Home';
import { LandlordHome } from './components/LandlordHome';
import { AuthScreen } from './components/AuthScreen';
import { PropertyDetail } from './components/PropertyDetail';
import { LandlordDashboard } from './components/LandlordDashboard';
import { ChatPage } from './components/ChatPage';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { ProfilePage } from './components/ProfilePage';
import { TenantMyPropertiesPage } from './components/TenantMyPropertiesPage';
import { TenantLeaseApplicationsPage } from './components/TenantLeaseApplicationsPage';
import { MockDateDevBanner } from './components/MockDateDevBanner';
import { supabase } from './lib/supabase';
import { AUTH_ROLE_STORAGE_KEY, getRoleFromMetadata, getStoredAuthRole } from './lib/auth';
import { syncProfileForUser } from './lib/profiles';
import {
  clearPasswordRecoveryPending,
  clearPasswordRecoveryUrl,
  initAuthFromUrl,
  isPasswordRecoveryPending,
  markPasswordRecoveryPending,
  shouldShowPasswordRecoveryScreen,
} from './lib/passwordRecovery';
import {
  type AppScreen,
  type StoredNav,
  goBackInHistory,
  persistAppNav,
  pushAppNavHistory,
  readAppNav,
  replaceAppNavHistory,
  syncNavFromUrl,
} from './lib/appNav';
import { loadPropertyById } from './lib/properties';

export type UserRole = 'tenant' | 'landlord' | null;

export interface Property {
  id: string;
  landlordId?: string;
  title: string;
  image: string;
  price: number;
  area: number;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  district?: string;
  isFavorite: boolean;
  roomFeatures?: string[];
  amenities?: string[];
  buildingAge?: 'new' | '5-10' | '10-20' | '20+';
  schoolCatchment?: string;
}

export default function App() {
  const [initialNav] = useState(() => readAppNav());
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(initialNav.screen);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(initialNav.property);
  const [propertyResolving, setPropertyResolving] = useState(
    initialNav.screen === 'property' && !initialNav.property && Boolean(initialNav.propertyId),
  );
  const navRef = useRef({ screen: currentScreen, property: selectedProperty });
  const restoringHistoryRef = useRef(false);

  useEffect(() => {
    navRef.current = { screen: currentScreen, property: selectedProperty };
  }, [currentScreen, selectedProperty]);

  const setNavState = useCallback((screen: AppScreen, property: Property | null) => {
    setCurrentScreen(screen);
    setSelectedProperty(screen === 'property' ? property : null);
  }, []);

  const navigate = useCallback(
    (screen: AppScreen, property: Property | null = null) => {
      if (restoringHistoryRef.current) return;
      setPropertyResolving(false);
      const nextProperty = screen === 'property' ? property : null;
      setNavState(screen, nextProperty);
      pushAppNavHistory(screen, nextProperty);
    },
    [setNavState],
  );

  const restoreNav = useCallback(
    async (nav: StoredNav, options?: { fromHistory?: boolean }) => {
      restoringHistoryRef.current = true;
      try {
        if (nav.screen === 'reset-password') {
          setNavState('reset-password', null);
          return;
        }

        if (nav.screen === 'property') {
          if (nav.property) {
            setPropertyResolving(false);
            setNavState('property', nav.property);
            persistAppNav('property', nav.property);
            return;
          }
          if (nav.propertyId) {
            setNavState('property', null);
            setPropertyResolving(true);
            const property = await loadPropertyById(nav.propertyId);
            setPropertyResolving(false);
            if (property) {
              setNavState('property', property);
              persistAppNav('property', property);
              return;
            }
          }
          setNavState('home', null);
          persistAppNav('home', null);
          if (!options?.fromHistory) {
            replaceAppNavHistory('home', null);
          }
          return;
        }

        setPropertyResolving(false);
        setNavState(nav.screen, null);
        persistAppNav(nav.screen, null);
      } finally {
        restoringHistoryRef.current = false;
      }
    },
    [setNavState],
  );

  const goBack = useCallback(
    (fallbackScreen: AppScreen = 'home', fallbackProperty: Property | null = null) => {
      goBackInHistory(() => navigate(fallbackScreen, fallbackProperty));
    },
    [navigate],
  );

  useEffect(() => {
    if (shouldShowPasswordRecoveryScreen()) return;
    replaceAppNavHistory(initialNav.screen, initialNav.property);
  }, [initialNav]);

  useEffect(() => {
    if (initialNav.screen === 'property' && !initialNav.property && initialNav.propertyId) {
      void restoreNav(initialNav);
    }
  }, [initialNav, restoreNav]);

  useEffect(() => {
    return syncNavFromUrl((nav) => {
      const current = navRef.current;
      const sameScreen = nav.screen === current.screen;
      const sameProperty =
        nav.screen !== 'property' ||
        nav.propertyId === current.property?.id ||
        nav.property?.id === current.property?.id;
      if (sameScreen && sameProperty) return;
      void restoreNav(nav, { fromHistory: true });
    });
  }, [restoreNav]);

  useEffect(() => {
    const persistOnHide = () => {
      if (document.visibilityState !== 'hidden') return;
      const { screen, property } = navRef.current;
      persistAppNav(screen, property);
    };
    window.addEventListener('pagehide', persistOnHide);
    return () => window.removeEventListener('pagehide', persistOnHide);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applySession = async (
      session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>,
      options?: { forceRecovery?: boolean },
    ) => {
      const metadataRole = getRoleFromMetadata(session.user.user_metadata);
      const resolvedRole = metadataRole ?? getStoredAuthRole();
      await syncProfileForUser(session.user, resolvedRole);
      if (!isMounted) return;
      setIsAuthenticated(true);
      setUserRole(resolvedRole);
      if (options?.forceRecovery || isPasswordRecoveryPending()) {
        markPasswordRecoveryPending();
        setCurrentScreen('reset-password');
        return;
      }
    };

    const bootstrap = async () => {
      try {
        const recovery = await initAuthFromUrl();
        if (!isMounted) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && (recovery || isPasswordRecoveryPending())) {
          await applySession(session, { forceRecovery: true });
        } else if (recovery || isPasswordRecoveryPending()) {
          setCurrentScreen('reset-password');
        } else if (session) {
          await applySession(session);
        }
      } catch (error) {
        console.error('[Thouse] auth bootstrap failed:', error);
        if (isMounted && isPasswordRecoveryPending()) {
          setCurrentScreen('reset-password');
        }
      } finally {
        if (isMounted) setAuthBootstrapping(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        markPasswordRecoveryPending();
        setCurrentScreen('reset-password');
        if (session) void applySession(session, { forceRecovery: true });
        clearPasswordRecoveryUrl();
        return;
      }

      if (session && isPasswordRecoveryPending()) {
        void applySession(session, { forceRecovery: true });
        return;
      }

      if (event === 'SIGNED_OUT') {
        clearPasswordRecoveryPending();
        setIsAuthenticated(false);
        setUserRole(null);
        return;
      }

      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        void applySession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = (role: UserRole) => {
    localStorage.setItem(AUTH_ROLE_STORAGE_KEY, role ?? 'tenant');
    setUserRole(role);
    setIsAuthenticated(true);
    navigate('home');
  };

  const handlePropertyClick = (property: Property) => {
    navigate('property', property);
  };

  const handleSignOut = async () => {
    localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserRole(null);
    navigate('home');
  };

  const showBlockingLoader = authBootstrapping && currentScreen !== 'reset-password';

  if (showBlockingLoader) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        載入中…
      </div>
    );
  }

  const showPropertyResolving =
    currentScreen === 'property' && !selectedProperty && propertyResolving;

  if (showPropertyResolving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        載入中…
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-gray-50">
      <MockDateDevBanner />
      {currentScreen === 'home' && (!isAuthenticated || userRole !== 'landlord') && (
        <Home
          onAuthClick={(role) => setCurrentScreen(role === 'tenant' ? 'auth-tenant' : 'auth-landlord')}
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          onSignOut={handleSignOut}
          onPropertyClick={handlePropertyClick}
          onLandlordDashboard={() => navigate('landlord-dashboard')}
          onChatClick={() => navigate('chat')}
          onProfileClick={() => navigate('profile')}
          onMyPropertiesClick={() => navigate('my-properties')}
          onGoHome={() => navigate('home')}
        />
      )}
      {currentScreen === 'home' && isAuthenticated && userRole === 'landlord' && (
        <LandlordHome
          onSignOut={handleSignOut}
          onPropertyClick={handlePropertyClick}
          onChatClick={() => navigate('chat')}
          onProfileClick={() => navigate('profile')}
          onGoHome={() => navigate('home')}
        />
      )}
      {currentScreen === 'auth-tenant' && (
        <AuthScreen role="tenant" onAuthSuccess={handleAuthSuccess} onBack={() => goBack('home')} />
      )}
      {currentScreen === 'auth-landlord' && (
        <AuthScreen role="landlord" onAuthSuccess={handleAuthSuccess} onBack={() => goBack('home')} />
      )}
      {currentScreen === 'property' && !selectedProperty && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4 text-center text-sm text-gray-600">
          <p>找不到此租盤，可能已下架或連結無效。</p>
          <button
            type="button"
            className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => navigate('home')}
          >
            返回首頁
          </button>
        </div>
      )}
      {currentScreen === 'property' && selectedProperty && (
        <PropertyDetail
          property={selectedProperty}
          onBack={() => goBack('home')}
          isAuthenticated={isAuthenticated}
          onRequireAuth={() => setCurrentScreen('auth-tenant')}
        />
      )}
      {currentScreen === 'landlord-dashboard' && (
        <LandlordDashboard onBack={() => goBack('home')} />
      )}
      {currentScreen === 'chat' && (
        <ChatPage
          userRole={userRole === 'landlord' ? 'landlord' : 'tenant'}
          onBack={() => goBack('home')}
        />
      )}
      {currentScreen === 'reset-password' && (
        <ResetPasswordScreen
          onBack={() => goBack('home')}
          onSuccess={() => {
            clearPasswordRecoveryPending();
            navigate('home');
          }}
        />
      )}
      {currentScreen === 'profile' && (
        <ProfilePage onBack={() => goBack('home')} onSignOut={handleSignOut} />
      )}
      {currentScreen === 'my-properties' && (
        <TenantMyPropertiesPage
          onBack={() => goBack('home')}
          onApplicationsClick={() => navigate('lease-applications')}
        />
      )}
      {currentScreen === 'lease-applications' && (
        <TenantLeaseApplicationsPage onBack={() => goBack('my-properties')} />
      )}
      <Toaster richColors position="top-center" />
    </div>
  );
}
