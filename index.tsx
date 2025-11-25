
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SystemErrorBoundary } from './components/SystemErrorBoundary';
import { ServiceProvider } from './contexts/ServiceContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <SystemErrorBoundary>
      <ServiceProvider>
        <App />
      </ServiceProvider>
    </SystemErrorBoundary>
  </StrictMode>
);
