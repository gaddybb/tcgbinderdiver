import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { captureInstallOffer } from './app/pwa/install';
import { registerServiceWorker } from './app/pwa/register';
import './app/theme/global.css';

captureInstallOffer();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
