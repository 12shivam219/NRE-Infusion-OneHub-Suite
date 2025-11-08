// Global state to prevent auth loops
let authLoopDetected = false;
let authRequestCount = 0;
let lastResetTime = Date.now();
let appStartTime = Date.now();
const APP_STARTUP_GRACE_PERIOD = 15000; // 15 seconds// Enhanced auth loop detection with startup grace period
const authGlobalState = {
  recordAuthRequest: (url?: string) => {
    // Skip counting CSRF-related requests
    if (url && (url.includes('/api/health') || url.includes('csrf'))) {
      return false;
    }
    
    const now = Date.now();
    const isAppStartup = now - appStartTime < 30000;
    const threshold = isAppStartup ? 30 : 15; // Reduced thresholds
    
    const resetInterval = isAppStartup ? 20000 : 15000;
    
    if (now - lastResetTime > resetInterval) {
      authRequestCount = 0;
      authLoopDetected = false;
      localStorage.removeItem('authLoopDetected');
    }
    
    authRequestCount++;
    lastResetTime = now;
    
    if (authRequestCount > threshold) {
      console.warn(`Auth loop detected: ${authRequestCount} requests in ${resetInterval}ms`);
      authLoopDetected = true;
      localStorage.setItem('authLoopDetected', 'true');
      setTimeout(() => {
        authLoopDetected = false;
        authRequestCount = 0;
        localStorage.removeItem('authLoopDetected');
      }, 5000);
      return true;
    }
    
    return authLoopDetected;
  },


  reset(): void {
    authLoopDetected = false;
    authRequestCount = 0;
    lastResetTime = Date.now();
    appStartTime = Date.now(); // Reset app start time on manual reset
  },

  isLoopDetected(): boolean {
    return authLoopDetected;
  },

  shouldPreventAuthRequest(): boolean {
    // Only prevent if actively in a loop (don't rely on stale localStorage)
    const now = Date.now();
    const storedLoop = localStorage.getItem('authLoopDetected');
    const lastLoopTime = localStorage.getItem('lastAuthLoopReset');
    
    // Clear old loop flags after 10 seconds
    if (storedLoop === 'true' && lastLoopTime) {
      const timeSinceLoop = now - parseInt(lastLoopTime);
      if (timeSinceLoop > 10000) {
        localStorage.removeItem('authLoopDetected');
        localStorage.removeItem('lastAuthLoopReset');
        return false;
      }
    }
    
    return authLoopDetected;
  }
};

export { authGlobalState };
