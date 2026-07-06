import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { InfoPageId } from '../content/infoPages';
import { StaticInfoPage } from '../components/info/StaticInfoPage';

type InfoPagesContextValue = {
  openInfoPage: (id: InfoPageId) => void;
  closeInfoPage: () => void;
};

const InfoPagesContext = createContext<InfoPagesContextValue | null>(null);

export function InfoPagesProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<InfoPageId | null>(null);
  const closingFromButtonRef = useRef(false);

  const openInfoPage = useCallback((id: InfoPageId) => {
    setActivePage(id);
    window.history.pushState({ thouseInfoPage: id }, '', window.location.href);
  }, []);

  const closeInfoPage = useCallback(() => {
    if (window.history.state?.thouseInfoPage) {
      closingFromButtonRef.current = true;
      window.history.back();
      return;
    }
    setActivePage(null);
  }, []);

  useEffect(() => {
    if (activePage == null) return;

    const onPopState = () => {
      if (closingFromButtonRef.current) {
        closingFromButtonRef.current = false;
      }
      setActivePage(null);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activePage]);

  const value = useMemo(
    () => ({ openInfoPage, closeInfoPage }),
    [openInfoPage, closeInfoPage]
  );

  return (
    <InfoPagesContext.Provider value={value}>
      {children}
      {activePage != null
        ? createPortal(
            <StaticInfoPage id={activePage} onClose={closeInfoPage} />,
            document.body
          )
        : null}
    </InfoPagesContext.Provider>
  );
}

export function useInfoPages() {
  const ctx = useContext(InfoPagesContext);
  if (!ctx) {
    throw new Error('useInfoPages must be used within InfoPagesProvider');
  }
  return ctx;
}
