import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { logStartupInfo } from './lib/debug';
import { clearAllClientAuthData } from './lib/clearAuthData';
import { initializeMessaging } from './lib/messaging';
import { initializeVitalsMonitoring } from './lib/performance-monitoring';

// Enhanced service worker registration with better error handling
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      // First, ensure any existing service workers are properly terminated
      const existingRegistrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(existingRegistrations.map((reg) => reg.unregister()));

      if (import.meta.env.PROD) {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none', // Prevent browser cache issues
        });

        // Handle service worker lifecycle
        if (registration.installing) {
          console.log('Service worker installing');
        } else if (registration.waiting) {
          console.log('Service worker installed');
        } else if (registration.active) {
          console.log('Service worker active');
        }

        // Set up message handling (avoid port initialization issues)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SERVICE_WORKER_ERROR') {
            console.warn('Service worker error:', event.data.error);
          }
        });
        
        // Skip MessageChannel port initialization to avoid "Receiving end does not exist" errors
        // The service worker handles all messaging via standard postMessage instead

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker available');
              }
            });
          }
        });
      } else {
        console.log('Service worker disabled in development mode');
      }
    } catch (error) {
      console.warn('Service worker registration/unregistration error:', error);
    }
  }
}

// Register SW when the app loads
window.addEventListener('load', registerServiceWorker);

// Log startup info for debugging
logStartupInfo();

// Initialize Core Web Vitals monitoring in production
if (import.meta.env.PROD) {
  initializeVitalsMonitoring();
}

createRoot(document.getElementById('root')!).render(<App />);

// Cross-tab logout listener
if ('BroadcastChannel' in window) {
  const bc = new BroadcastChannel('rcp-auth');
  bc.addEventListener('message', (ev) => {
    try {
      if (ev.data?.type === 'logout') {
        clearAllClientAuthData({ preservePreferences: true }).then(() => {
          // Use safe navigation utility
          import('./lib/navigation').then(({ safeRedirect }) => {
            safeRedirect('/');
          });
        });
      }
    } catch (e) {
      console.error('Error handling broadcast logout:', e);
    }
  });
}

// Fallback storage event listener
window.addEventListener('storage', (ev) => {
  if (ev.key === 'rcp-logout') {
    clearAllClientAuthData({ preservePreferences: true }).then(() => {
      import('./lib/navigation').then(({ safeRedirect }) => {
        safeRedirect('/');
      });
    });
  }
});

// Intelligent prefetching of anticipated routes based on auth state (production only)
if (import.meta.env.PROD && 'requestIdleCallback' in window) {
  requestIdleCallback(() => {
    const isAuth = !!localStorage.getItem('rcp_token');
    // Prefetch editor page only for authenticated users who visit resumes
    if (isAuth && window.location.pathname.includes('/dashboard')) {
      // Preload editor page chunks
      import('@/components/SuperDocEditor/SuperDocEditorLazy')
        .catch(() => {});
    }
  }, { timeout: 5000 });
}

// Auto-logout after 24 hours from login (client-side enforcement)
try {
  const LOGIN_TTL = 24 * 60 * 60 * 1000; // 24 hours
  const loginTimeStr =
    localStorage.getItem('rcp_loginAt') || localStorage.getItem('lastActiveTime') || '0';
  const loginAt = parseInt(loginTimeStr, 10) || 0;
  const now = Date.now();

  if (loginAt > 0) {
    const elapsed = now - loginAt;
    if (elapsed >= LOGIN_TTL) {
      // expired - perform cleanup immediately
      clearAllClientAuthData({ preservePreferences: true }).then(() => {
        import('./lib/navigation').then(({ safeRedirect }) => {
          safeRedirect('/');
        });
      });
    } else {
      // schedule remaining time
      setTimeout(() => {
        clearAllClientAuthData({ preservePreferences: true }).then(() =>
          window.location.replace('/')
        );
      }, LOGIN_TTL - elapsed);
    }
  }
} catch (e) {
  console.error('Auto-logout initialization error:', e);
}
