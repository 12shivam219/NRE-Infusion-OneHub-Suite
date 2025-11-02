import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

/**
 * RoleBasedRoute Component
 * Protects routes based on user roles
 * Redirects to appropriate page if user doesn't have required role
 */
export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  // Always declare useEffect, but control its behavior with state
  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        const redirectUrl = `/login?redirect=${encodeURIComponent(location)}`;
        if (location !== redirectUrl) {
          setLocation(redirectUrl);
        }
      } else {
        const userRole = user.role || 'user';
        const hasRequiredRole = allowedRoles.includes(userRole);
        if (!hasRequiredRole) {
          setLocation('/unauthorized');
        }
      }
    }
  }, [isLoading, isAuthenticated, user, location, allowedRoles]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render children until we're sure about authentication and authorization
  if (!isAuthenticated || !user) {
    return null;
  }

  const userRole = user.role || 'user';
  const hasRequiredRole = allowedRoles.includes(userRole);

  if (!hasRequiredRole) {
    return null;
  }

  // User has required role, render children
  return <>{children}</>;
}

/**
 * AdminRoute Component
 * Shortcut for admin-only routes
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return <RoleBasedRoute allowedRoles={['admin']}>{children}</RoleBasedRoute>;
}

/**
 * MarketingRoute Component
 * Shortcut for marketing and admin routes
 */
export function MarketingRoute({ children }: { children: React.ReactNode }) {
  return <RoleBasedRoute allowedRoles={['marketing', 'admin']}>{children}</RoleBasedRoute>;
}
