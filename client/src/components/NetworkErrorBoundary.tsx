import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface NetworkErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class NetworkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  NetworkErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Only handle network-related errors
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Network request failed')
    ) {
      return { hasError: true, error };
    }
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Network Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p className="text-gray-600 text-center mb-6">
            Unable to connect to the server. Please check your internet connection and try again.
          </p>
          <Button onClick={this.handleRetry} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withNetworkStatus<P extends object>(WrappedComponent: React.ComponentType<P>) {
  return function WithNetworkStatusComponent(props: P) {
    const { isOnline, networkType } = useNetworkStatus();

    if (!isOnline) {
      return (
        <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
          <p className="text-yellow-800 font-medium">You are offline</p>
          <p className="text-yellow-600 text-sm">Some features may be unavailable</p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
