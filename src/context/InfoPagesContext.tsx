import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

  const openInfoPage = useCallback((id: InfoPageId) => {
    setActivePage(id);
  }, []);

  const closeInfoPage = useCallback(() => {
    setActivePage(null);
  }, []);

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
