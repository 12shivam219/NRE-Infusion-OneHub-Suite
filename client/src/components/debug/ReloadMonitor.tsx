import { useEffect, useRef } from 'react';

interface ReloadEvent {
  timestamp: number;
  url: string;
  reason: string;
}

export const ReloadMonitor = () => {
  const mountTimeRef = useRef(Date.now());
  const reloadCountRef = useRef(0);

  useEffect(() => {
    const sessionKey = 'reload_monitor_session';
    const reloadKey = 'reload_events';
    
    // Check if this is a reload
    const lastSession = sessionStorage.getItem(sessionKey);
    const currentTime = Date.now();
    
    if (lastSession) {
      const timeSinceLastLoad = currentTime - parseInt(lastSession);
      
      // If less than 5 seconds since last load, it's likely a reload
      if (timeSinceLastLoad < 5000) {
        reloadCountRef.current++;
        
        const reloadEvent: ReloadEvent = {
          timestamp: currentTime,
          url: window.location.href,
          reason: `Quick reload detected (${timeSinceLastLoad}ms since last load)`
        };
        
        // Store reload events
        try {
          const existingEvents = JSON.parse(localStorage.getItem(reloadKey) || '[]');
          existingEvents.push(reloadEvent);
          
          // Keep only last 20 events
          const trimmedEvents = existingEvents.slice(-20);
          localStorage.setItem(reloadKey, JSON.stringify(trimmedEvents));
          
          console.warn('🔄 Page reload detected:', reloadEvent);
          
          // If too many reloads, warn user
          if (reloadCountRef.current > 3) {
            console.error('🚨 Excessive page reloads detected! Check console for details.');
            
            // Show reload events in console
            console.group('Recent Reload Events:');
            trimmedEvents.slice(-5).forEach((event: ReloadEvent, index: number) => {
              console.log(`${index + 1}. ${new Date(event.timestamp).toLocaleTimeString()} - ${event.reason}`);
            });
            console.groupEnd();
          }
        } catch (error) {
          console.warn('Failed to log reload event:', error);
        }
      }
    }
    
    // Update session timestamp
    sessionStorage.setItem(sessionKey, currentTime.toString());
    
    // Monitor for programmatic reloads using beforeunload
    window.addEventListener('beforeunload', (event) => {
      // Check if it's a programmatic reload (we can't detect the exact source, but we can log the event)
      const isReload = event.type === 'beforeunload' && document.visibilityState === 'visible';
      if (isReload) {
        console.warn('🔄 Page reload detected');
      }
    });
    
    // Monitor for navigation changes that might cause reloads
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      console.log('📍 Navigation: pushState to', args[2]);
      return originalPushState.apply(this, args);
    };
    
    history.replaceState = function(...args) {
      console.log('📍 Navigation: replaceState to', args[2]);
      return originalReplaceState.apply(this, args);
    };
    
    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', event => {});
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 9999,
        fontFamily: 'monospace'
      }}
    >
      🔄 Reload Monitor Active
      <br />
      Mount: {new Date(mountTimeRef.current).toLocaleTimeString()}
    </div>
  );
};

export default ReloadMonitor;