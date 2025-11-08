import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { clearAllClientAuthData } from '@/lib/clearAuthData';
import { authCircuitBreaker } from '@/lib/authCircuitBreaker';
import { authGlobalState } from '@/lib/authGlobalState';

export interface User {
  id: string;
  email: string;
  pseudoName?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: string; // 'user' | 'marketing' | 'admin'
  createdAt: string;
  updatedAt: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDisabled, setIsDisabled] = React.useState(false);
  
  // Check if we should prevent auth requests (but don't return early)
  const justLoggedOut = localStorage.getItem('justLoggedOut') === 'true';
  const shouldPreventAuth = justLoggedOut || authCircuitBreaker.isCircuitOpen() || authGlobalState.shouldPreventAuthRequest();

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        // Record that we're making an auth request
        authGlobalState.recordAuthRequest('/api/auth/user');

        const response = await fetch("/api/auth/user", {
          credentials: "include",
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          },
          redirect: 'manual', // Don't follow redirects automatically
          signal: AbortSignal.timeout(8000) // 8 second timeout
        });

        // Handle redirects manually
        if (response.status === 302 || response.status === 301) {
          throw new Error("UNAUTHORIZED");
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("UNAUTHORIZED");
          }
          if (response.status === 404) {
            throw new Error("USER_NOT_FOUND");
          }
          throw new Error(`HTTP_${response.status}`);
        }

        const data = await response.json();
        authCircuitBreaker.recordSuccess();

        // Clear any auth loop flags on successful authentication
        localStorage.removeItem('authLoopDetected');
        localStorage.removeItem('lastAuthLoopReset');
        localStorage.removeItem('lastAuthRedirect');
        localStorage.removeItem('lastPrivateRedirect');
        // IMPORTANT: Clear logout flag on successful login
        localStorage.removeItem('justLoggedOut');
        
        return data as User;
      } catch (error: any) {
        // For network errors, throw a specific error
        if (error.name === 'AbortError' || error.message === 'Failed to fetch') {
          throw new Error("NETWORK_ERROR");
        }
        
        // Only record failures for actual network/server errors, not auth failures
        if (error.message === 'NETWORK_ERROR') {
          authCircuitBreaker.recordFailure();
        }
        throw error;
      }
    },
    retry: (failureCount, error) => {
      // Don't retry auth errors
      if (error.message === 'UNAUTHORIZED' || error.message === 'USER_NOT_FOUND') {
        return false;
      }
      // Retry network errors up to 1 time only
      return failureCount < 1;
    },
    retryDelay: 500, // Reduced from 1000ms
    staleTime: 60 * 1000, // 60 seconds (increased from 30)
    gcTime: 10 * 60 * 1000, // Keep longer in cache to avoid refetch
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchOnMount: true, // Refetch on mount to ensure fresh auth state
    enabled: !isDisabled && !shouldPreventAuth,
  });

  // Simplified error handling to prevent loops
  React.useEffect(() => {
    if (error && error.message) {
      const path = window.location.pathname;
      const onAuthPages = ['/login', '/register', '/verify-email', '/', '/privacy'].includes(path);
      
      // Only handle auth errors, ignore others to prevent loops
      if (error.message === 'UNAUTHORIZED' && !onAuthPages) {
        // Disable the query immediately to stop further requests
        setIsDisabled(true);
        
        // Simple throttled redirect
        const lastRedirect = localStorage.getItem('lastAuthRedirect');
        const now = Date.now();
        
        if (!lastRedirect || (now - parseInt(lastRedirect)) > 5000) {
          localStorage.setItem('lastAuthRedirect', now.toString());
          // Clear the query data to prevent stale state
          queryClient.setQueryData(["/api/auth/user"], null);
          // Only store redirect path for non-dashboard pages to prevent unwanted redirects
          if (path !== '/dashboard') {
            localStorage.setItem('redirectAfterLogin', path);
          } else {
            localStorage.removeItem('redirectAfterLogin');
          }
          window.location.href = '/login';
        }
      }
    }
  }, [error, queryClient]);

  // Define clearLocalSession outside of logout to make it reusable
  const clearLocalSession = async () => {
    try {
      // Set logout flag to prevent re-authentication
      localStorage.setItem('justLoggedOut', 'true');
      
      // Immediately clear query cache
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.removeQueries({ queryKey: ["/api/auth/user"] });
      
      // Clear all auth-related localStorage
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.includes('auth') || 
        key.includes('user') || 
        key.includes('session') || 
        key.includes('token') ||
        key.includes('lastActiveTime') ||
        key.includes('rcp_') ||
        key.includes('lastAuthRedirect') ||
        key.includes('authLoopDetected') ||
        key.includes('lastAuthLoopReset')
      );
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear session storage
      sessionStorage.clear();
      
      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // Run heavy cleanup in background (non-blocking)
      // Don't await this - let it complete in the background
      clearAllClientAuthData({ preservePreferences: true }).catch(e => {
        console.error('Background cleanup error:', e);
      });
      
      // Clear logout flag after 5 seconds (allow re-login)
      setTimeout(() => {
        localStorage.removeItem('justLoggedOut');
      }, 5000);
    } catch (e) {
      console.error('Error clearing local session:', e);
      // Fallback cleanup
      queryClient.removeQueries({ queryKey: ["/api/auth/user"] });
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  const logout = async () => {
    try {
      // IMMEDIATELY disable the auth query to prevent re-fetching
      setIsDisabled(true);
      
      // Show logout message immediately
      toast({
        title: "Logging out...",
        description: "Redirecting...",
        duration: 300,
      });

      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      // IMMEDIATELY clear query cache BEFORE server call
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.removeQueries({ queryKey: ["/api/auth/user"] });

      // Start server logout (don't await - do it in background)
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        signal: AbortSignal.timeout(2000), // 2 second timeout
      })
        .then(response => {
          if (response.ok) {
            console.log("Server logout completed successfully");
          } else {
            console.warn("Server logout returned non-200 status:", response.status);
          }
        })
        .catch(serverError => {
          console.warn("Server logout failed:", serverError);
        });

      // Clear local session data immediately (non-blocking)
      clearLocalSession();
      
      // Redirect IMMEDIATELY - the query is already disabled
      setTimeout(() => {
        window.location.href = "/";
      }, 100); // Minimal delay
      
    } catch (error) {
      console.error("Logout error:", error);
      setIsDisabled(true);
      // Force redirect for security
      window.location.href = "/";
    }
  };

  const refreshUser = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error) {
      console.error("Error refreshing user data:", error);
      toast({
        variant: "destructive",
        title: "Refresh Error",
        description: "Failed to refresh user data. Please try again.",
      });
    }
  };

  // Add an interval to check session activity - only when authenticated
  React.useEffect(() => {
    // Only run session timeout logic when user is authenticated
    if (!user) {
      return;
    }

    const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes (match server session)
    const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute

    const checkSessionActivity = () => {
      const lastActiveTime = localStorage.getItem("lastActiveTime");
      if (lastActiveTime) {
        const inactiveTime = Date.now() - parseInt(lastActiveTime);
        if (inactiveTime > SESSION_TIMEOUT) {
          logout();
        }
      }
    };

    // Update last active time on user interaction
    const updateLastActiveTime = () => {
      localStorage.setItem("lastActiveTime", Date.now().toString());
    };

    // Set up activity listeners
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, updateLastActiveTime);
    });

    // Initial setup - reset activity time for fresh authentication
    updateLastActiveTime();

    // Set up interval check
    const interval = setInterval(checkSessionActivity, ACTIVITY_CHECK_INTERVAL);

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateLastActiveTime);
      });
      clearInterval(interval);
    };
  }, [user]); // Depend on user so it resets when authentication state changes

  // If auth is prevented by circuit breaker, return unauthenticated state
  if (shouldPreventAuth) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAuthChecked: true,
      error: { message: 'CIRCUIT_BREAKER_OPEN' } as any,
      logout: async () => {},
      refreshUser: async () => {},
    };
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAuthChecked: !isLoading && (!!user || !!error), // Auth has been checked if not loading and we have user or error
    error,
    logout,
    refreshUser,
  };
}

