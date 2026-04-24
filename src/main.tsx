import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { InfoPagesProvider } from './context/InfoPagesContext';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import './index.css';

const el = document.getElementById('root');
if (!el) {
  throw new Error('找不到 #root，請檢查 index.html');
}

createRoot(el).render(
  <RootErrorBoundary>
    <InfoPagesProvider>
      <App />
    </InfoPagesProvider>
  </RootErrorBoundary>
);
  