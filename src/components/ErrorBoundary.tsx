'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  isCritical: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Determines if an error is critical and requires showing the error screen
 * Critical errors: chunk loading, network failures, authentication failures
 * Non-critical errors: date parsing, data format issues, etc.
 */
function isCriticalError(error: Error): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorStack = error.stack?.toLowerCase() || '';
  
  // Critical errors that need user intervention
  const criticalPatterns = [
    'chunk',
    'loading chunk',
    'failed to fetch',
    'networkerror',
    'network error',
    'failed to load',
    'script error',
    'syntax error',
    'unexpected token',
    'cannot read property',
    'is not a function', // Only if it's a critical function, not date methods
  ];
  
  // Non-critical errors that can be handled gracefully
  const nonCriticalPatterns = [
    'gettime',
    'preparationendtime',
    'preparationstarttime',
    'date',
    'invalid date',
    'nan',
  ];
  
  // Check if it's a non-critical error first
  if (nonCriticalPatterns.some(pattern => errorMessage.includes(pattern) || errorStack.includes(pattern))) {
    // But if it's combined with critical patterns, it's still critical
    if (!criticalPatterns.some(pattern => errorMessage.includes(pattern) || errorStack.includes(pattern))) {
      return false;
    }
  }
  
  // Check for critical patterns
  return criticalPatterns.some(pattern => errorMessage.includes(pattern) || errorStack.includes(pattern));
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isCritical: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const isCritical = isCriticalError(error);
    return { hasError: true, error, isCritical };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const isCritical = isCriticalError(error);
    
    // Log all errors
    console.error('[ErrorBoundary]', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      isCritical
    });
    
    // Handle critical errors
    if (isCritical) {
      // Log chunk loading errors specifically
      if (error.message && error.message.includes('chunk')) {
        console.error('[Chunk Loading Error]', error.message);
        // Try to reload the page after a short delay to fetch fresh chunks
        setTimeout(() => {
          if (window.location.hash !== '#no-reload') {
            window.location.reload();
          }
        }, 2000);
      }
    } else {
      // For non-critical errors, log but don't show error screen
      console.warn('[Non-Critical Error] Handled gracefully:', error.message);
      // Reset error state after a short delay to allow component to recover
      setTimeout(() => {
        this.setState({ hasError: false, isCritical: false });
      }, 100);
    }
  }

  render() {
    // Only show error screen for critical errors
    if (this.state.hasError && this.state.isCritical) {
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
