import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { InfoPagesProvider } from './context/InfoPagesContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <InfoPagesProvider>
    <App />
  </InfoPagesProvider>
);
  