'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center p-8 max-w-md w-full">
            <div className="mb-6">
              <div className="text-6xl mb-4">📱</div>
              <h1 className="text-2xl font-bold text-foreground mb-4">
                Something went wrong
              </h1>
              <p className="text-muted-foreground mb-6">
                We're sorry, but something unexpected happened. This might be a mobile-specific issue.
              </p>
            </div>
            
            {/* Mobile-specific troubleshooting */}
            <div className="space-y-4 mb-6 text-left">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">📱 Mobile Troubleshooting:</h3>
                <ul className="text-sm space-y-1">
                  <li>• Try refreshing the page</li>
                  <li>• Check your internet connection</li>
                  <li>• Clear browser cache</li>
                  <li>• Try in landscape mode</li>
                  <li>• Update your browser</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">🔧 Technical Details:</h3>
                <p className="text-xs text-muted-foreground">
                  Error: {this.state.error?.message || 'Unknown error'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Device: {navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
              >
                🔄 Reload Page
              </button>
              
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 text-sm"
              >
                🗑️ Clear Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
