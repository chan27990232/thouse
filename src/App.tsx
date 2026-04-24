import { useEffect, useState } from 'react';
import { Home } from './components/Home';
import { LandlordHome } from './components/LandlordHome';
import { AuthScreen } from './components/AuthScreen';
import { PropertyDetail } from './components/PropertyDetail';
import { LandlordDashboard } from './components/LandlordDashboard';
import { ChatPage } from './components/ChatPage';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { ProfilePage } from './components/ProfilePage';
import { supabase } from './lib/supabase';
import { AUTH_ROLE_STORAGE_KEY, getRoleFromMetadata, getStoredAuthRole } from './lib/auth';
import { syncProfileForUser } from './lib/profiles';

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
  isFavorite: boolean;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<
    'home' | 'auth-tenant' | 'auth-landlord' | 'property' | 'landlord-dashboard' | 'chat' | 'reset-password' | 'profile'
  >('home');
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (session) {
        const metadataRole = getRoleFromMetadata(session.user.user_metadata);
        const resolvedRole = metadataRole ?? getStoredAuthRole();
        await syncProfileForUser(session.user, resolvedRole);
        setIsAuthenticated(true);
        setUserRole(resolvedRole);
        const isRecoveryFlow = window.location.hash.includes('type=recovery');
        setCurrentScreen(isRecoveryFlow ? 'reset-password' : 'home');
      }
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCurrentScreen('reset-password');
        return;
      }

      if (session) {
        const metadataRole = getRoleFromMetadata(session.user.user_metadata);
        const resolvedRole = metadataRole ?? getStoredAuthRole();
        void (async () => {
          await syncProfileForUser(session.user, resolvedRole);
          setIsAuthenticated(true);
          setUserRole(resolvedRole);
          setCurrentScreen('home');
        })();
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
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
    setCurrentScreen('home');
  };

  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property);
    setCurrentScreen('property');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setSelectedProperty(null);
  };

  const handleSignOut = async () => {
    localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentScreen('home');
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-gray-50">
      {currentScreen === 'home' && (!isAuthenticated || userRole !== 'landlord') && (
        <Home
          onAuthClick={(role) => setCurrentScreen(role === 'tenant' ? 'auth-tenant' : 'auth-landlord')}
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          onSignOut={handleSignOut}
          onPropertyClick={handlePropertyClick}
          onLandlordDashboard={() => setCurrentScreen('landlord-dashboard')}
          onChatClick={() => setCurrentScreen('chat')}
          onProfileClick={() => setCurrentScreen('profile')}
        />
      )}
      {currentScreen === 'home' && isAuthenticated && userRole === 'landlord' && (
        <LandlordHome 
          onSignOut={handleSignOut}
          onPropertyClick={handlePropertyClick}
          onChatClick={() => setCurrentScreen('chat')}
          onProfileClick={() => setCurrentScreen('profile')}
        />
      )}
      {currentScreen === 'auth-tenant' && (
        <AuthScreen 
          role="tenant" 
          onAuthSuccess={handleAuthSuccess}
          onBack={handleBackToHome}
        />
      )}
      {currentScreen === 'auth-landlord' && (
        <AuthScreen 
          role="landlord" 
          onAuthSuccess={handleAuthSuccess}
          onBack={handleBackToHome}
        />
      )}
      {currentScreen === 'property' && selectedProperty && (
        <PropertyDetail
          property={selectedProperty}
          onBack={handleBackToHome}
          isAuthenticated={isAuthenticated}
        />
      )}
      {currentScreen === 'landlord-dashboard' && (
        <LandlordDashboard 
          onBack={() => {
            setCurrentScreen('home');
          }}
        />
      )}
      {currentScreen === 'chat' && (
        <ChatPage
          userRole={userRole === 'landlord' ? 'landlord' : 'tenant'}
          onBack={() => setCurrentScreen('home')}
        />
      )}
      {currentScreen === 'reset-password' && (
        <ResetPasswordScreen
          onBack={() => setCurrentScreen('home')}
          onSuccess={() => setCurrentScreen('home')}
        />
      )}
      {currentScreen === 'profile' && (
        <ProfilePage
          onBack={() => setCurrentScreen('home')}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}