import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Bell, LogOut, Mail, MessageSquare, FileText, Zap, Shield, Menu, X } from 'lucide-react';
import type { User as ClientUser } from '@/hooks/useAuth';

interface AppHeaderProps {
  currentPage?: 'dashboard' | 'email' | 'marketing' | 'editor' | 'admin';
}

export function AppHeader({ currentPage = 'dashboard' }: AppHeaderProps) {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Smart scroll behavior - hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 10) {
        // Always show at top
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down & past 100px - hide
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      // Error handling is already done in useAuth.logout()
      console.error('Logout error:', error);
    }
  }, [logout]);

  return (
    <header
      className={`glass-effect border-b border-border sticky top-0 z-50 shadow-sm transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg p-1"
            aria-label="Go to Dashboard"
          >
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight hidden sm:block">NRE OneHub Suite</h1>
            <h1 className="text-lg font-bold text-foreground tracking-tight sm:hidden">OneHub</h1>
          </button>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>

          {/* Desktop Navigation */}
          <nav
            className="hidden md:flex items-center space-x-4"
            role="navigation"
            aria-label="Main navigation"
          >
            {/* Email Button - Only show for marketing and admin users */}
            {(user?.role === 'marketing' || user?.role === 'admin') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentPage === 'email' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => navigate('/email')}
                    className={`transition-all duration-200 ${
                      currentPage === 'email'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    }`}
                    data-testid="button-email"
                    aria-label="Navigate to email page"
                  >
                    <Mail size={16} className="mr-1" />
                    <span className="hidden lg:inline">Email</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Gmail-style email client with multi-account support and secure OAuth.
                </TooltipContent>
              </Tooltip>
            )}

            {/* Marketing Button - Only show for marketing and admin users */}
            {(user?.role === 'marketing' || user?.role === 'admin') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentPage === 'marketing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => navigate('/marketing')}
                    className={`transition-all duration-200 ${
                      currentPage === 'marketing'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    }`}
                    data-testid="button-marketing"
                    aria-label="Navigate to marketing page"
                  >
                    <MessageSquare size={16} className="mr-1" />
                    <span className="hidden lg:inline">Marketing</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Create outreach emails, manage templates, and view engagement insights.
                </TooltipContent>
              </Tooltip>
            )}

            {/* Multi-Editor Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant={currentPage === 'editor' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => navigate('/editor')}
                    className={`transition-all duration-200 ${
                      currentPage === 'editor'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 hover:from-blue-100 hover:to-indigo-100'
                    }`}
                    data-testid="button-multi-editor"
                  >
                    <Zap size={16} className="mr-1" />
                    <span>Multi-Editor</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open Multi-Editor to edit multiple resumes side-by-side.
              </TooltipContent>
            </Tooltip>

            {/* Admin Button - Only show for admin users */}
            {user?.role === 'admin' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentPage === 'admin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => navigate('/admin')}
                    className={`transition-all duration-200 ${
                      currentPage === 'admin'
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                    }`}
                    data-testid="button-admin"
                    aria-label="Navigate to admin panel"
                  >
                    <Shield size={16} className="mr-1" />
                    <span className="hidden lg:inline">Admin</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Admin panel - manage users and system settings
                </TooltipContent>
              </Tooltip>
            )}

            <Button
              variant="ghost"
              size="sm"
              data-testid="button-notifications"
              aria-label="View notifications"
              className="focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Bell size={18} aria-hidden="true" />
            </Button>

            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {(user as ClientUser)?.pseudoName?.[0] ||
                    (user as ClientUser)?.firstName?.[0] ||
                    (user as ClientUser)?.email?.[0] ||
                    'U'}
                </span>
              </div>
              <span
                className="text-sm font-medium text-foreground hidden lg:inline-block"
                data-testid="text-username"
              >
                {(user as ClientUser)?.pseudoName ||
                  (user as ClientUser)?.firstName ||
                  (user as ClientUser)?.email ||
                  'User'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
                className="hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              >
                <LogOut size={16} className="mr-1.5" />
                <span className="hidden lg:inline-block">Logout</span>
              </Button>
            </div>
          </nav>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="px-4 py-4 space-y-3">
              {/* Mobile navigation items */}
              {(user?.role === 'marketing' || user?.role === 'admin') && (
                <Button
                  variant={currentPage === 'email' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    navigate('/email');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full justify-start ${
                    currentPage === 'email'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <Mail size={16} className="mr-2" />
                  Email
                </Button>
              )}

              {(user?.role === 'marketing' || user?.role === 'admin') && (
                <Button
                  variant={currentPage === 'marketing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    navigate('/marketing');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full justify-start ${
                    currentPage === 'marketing'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <MessageSquare size={16} className="mr-2" />
                  Marketing
                </Button>
              )}

              <Button
                variant={currentPage === 'editor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  navigate('/editor');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full justify-start ${
                  currentPage === 'editor'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 hover:from-blue-100 hover:to-indigo-100'
                }`}
              >
                <Zap size={16} className="mr-2" />
                Multi-Editor
              </Button>

              {user?.role === 'admin' && (
                <Button
                  variant={currentPage === 'admin' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    navigate('/admin');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full justify-start ${
                    currentPage === 'admin'
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  <Shield size={16} className="mr-2" />
                  Admin
                </Button>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-foreground">
                      {(user as ClientUser)?.pseudoName?.[0] ||
                        (user as ClientUser)?.firstName?.[0] ||
                        (user as ClientUser)?.email?.[0] ||
                        'U'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {(user as ClientUser)?.pseudoName ||
                      (user as ClientUser)?.firstName ||
                      (user as ClientUser)?.email ||
                      'User'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                >
                  <LogOut size={16} className="mr-1.5" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
