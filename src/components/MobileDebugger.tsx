'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Smartphone, Wifi, WifiOff, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface MobileDebugInfo {
  isMobile: boolean;
  userAgent: string;
  isOnline: boolean;
  hasServiceWorker: boolean;
  hasLocalStorage: boolean;
  hasSessionStorage: boolean;
  viewport: {
    width: number;
    height: number;
  };
  connectionType?: string;
  errors: string[];
}

export default function MobileDebugger() {
  const [debugInfo, setDebugInfo] = useState<MobileDebugInfo>({
    isMobile: false,
    userAgent: '',
    isOnline: true,
    hasServiceWorker: false,
    hasLocalStorage: false,
    hasSessionStorage: false,
    viewport: { width: 0, height: 0 },
    errors: []
  });

  const [swStatus, setSwStatus] = useState<'checking' | 'supported' | 'not-supported' | 'failed' | 'registered'>('checking');

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const checkMobileCompatibility = () => {
      const errors: string[] = [];
      
      // Check if mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Check online status
      const isOnline = navigator.onLine;
      
      // Check service worker support
      const hasServiceWorker = 'serviceWorker' in navigator;
      
      // Check storage support
      const hasLocalStorage = typeof Storage !== 'undefined' && localStorage !== null;
      const hasSessionStorage = typeof Storage !== 'undefined' && sessionStorage !== null;
      
      // Check viewport
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      // Check connection type (if available)
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const connectionType = connection?.effectiveType || 'unknown';
      
      // Mobile-specific error checks
      if (isMobile) {
        if (viewport.width < 320) {
          errors.push('Screen width too small (< 320px)');
        }
        if (viewport.height < 480) {
          errors.push('Screen height too small (< 480px)');
        }
        if (!hasServiceWorker) {
          errors.push('Service Worker not supported - this is normal on some mobile browsers');
        }
        if (!hasLocalStorage) {
          errors.push('Local Storage not supported');
        }
        if (connectionType === 'slow-2g' || connectionType === '2g') {
          errors.push('Slow network connection detected');
        }
      }
      
      setDebugInfo({
        isMobile,
        userAgent: navigator.userAgent,
        isOnline,
        hasServiceWorker,
        hasLocalStorage,
        hasSessionStorage,
        viewport,
        connectionType,
        errors
      });
    };

    // Check Service Worker status
    const checkServiceWorkerStatus = async () => {
      if (!('serviceWorker' in navigator)) {
        setSwStatus('not-supported');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          setSwStatus('registered');
        } else {
          setSwStatus('supported');
        }
      } catch (error) {
        setSwStatus('failed');
      }
    };

    checkMobileCompatibility();
    checkServiceWorkerStatus();
    
    // Listen for Service Worker events
    const handleSWRegistered = () => setSwStatus('registered');
    const handleSWFailed = () => setSwStatus('failed');
    
    window.addEventListener('sw-registered', handleSWRegistered);
    window.addEventListener('sw-failed', handleSWFailed);
    
    // Listen for online/offline changes
    const handleOnline = () => setDebugInfo(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setDebugInfo(prev => ({ ...prev, isOnline: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('sw-registered', handleSWRegistered);
      window.removeEventListener('sw-failed', handleSWFailed);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"}>
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  if (!debugInfo.isMobile) {
    return null; // Only show on mobile devices
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile Debug Information
          {debugInfo.errors.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {debugInfo.errors.length} Issues
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Mobile compatibility and performance diagnostics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status</span>
          <div className="flex items-center gap-2">
            {debugInfo.isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            {getStatusBadge(debugInfo.isOnline, "Online", "Offline")}
          </div>
        </div>

        {/* Device Type */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Device Type</span>
          <Badge variant="secondary">Mobile</Badge>
        </div>

        {/* Screen Size */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Screen Size</span>
          <Badge variant={debugInfo.viewport.width >= 320 ? "default" : "destructive"}>
            {debugInfo.viewport.width} × {debugInfo.viewport.height}
          </Badge>
        </div>

        {/* Connection Type */}
        {debugInfo.connectionType && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connection Type</span>
            <Badge variant={debugInfo.connectionType.includes('slow') ? "destructive" : "default"}>
              {debugInfo.connectionType}
            </Badge>
          </div>
        )}

        {/* Service Worker Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Service Worker</span>
          <div className="flex items-center gap-2">
            {swStatus === 'registered' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {swStatus === 'not-supported' && <XCircle className="h-4 w-4 text-yellow-500" />}
            {swStatus === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
            {swStatus === 'checking' && <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            <Badge variant={
              swStatus === 'registered' ? 'default' : 
              swStatus === 'not-supported' ? 'secondary' : 
              swStatus === 'failed' ? 'destructive' : 'outline'
            }>
              {swStatus === 'registered' ? 'Active' :
               swStatus === 'not-supported' ? 'Not Supported' :
               swStatus === 'failed' ? 'Failed' :
               swStatus === 'checking' ? 'Checking...' : 'Supported'}
            </Badge>
          </div>
        </div>

        {/* Browser Features */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Browser Features</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.hasLocalStorage)}
              <span>Local Storage</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.hasSessionStorage)}
              <span>Session Storage</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.isOnline)}
              <span>Network</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.hasServiceWorker)}
              <span>SW Support</span>
            </div>
          </div>
        </div>

        {/* Service Worker Information */}
        {swStatus === 'not-supported' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              ℹ️ Service Worker Not Supported
            </h4>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              This is normal on some mobile browsers. The app will work without offline features.
            </p>
          </div>
        )}

        {swStatus === 'failed' && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
              ⚠️ Service Worker Failed
            </h4>
            <p className="text-xs text-red-700 dark:text-red-300">
              Service Worker registration failed. This might be due to network issues or browser restrictions.
            </p>
          </div>
        )}

        {/* Issues */}
        {debugInfo.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Issues Found
            </h4>
            <div className="space-y-1">
              {debugInfo.errors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  • {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isExpanded ? 'Hide' : 'Show'} Technical Details
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              🔄 Reload
            </Button>
            <Button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
              variant="outline"
              size="sm"
            >
              🗑️ Clear Cache
            </Button>
          </div>
        </div>

        {/* Technical Details */}
        {isExpanded && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Technical Details</h4>
            <div className="text-xs space-y-1">
              <div><strong>User Agent:</strong> {debugInfo.userAgent}</div>
              <div><strong>Viewport:</strong> {debugInfo.viewport.width} × {debugInfo.viewport.height}</div>
              <div><strong>Connection:</strong> {debugInfo.connectionType || 'Unknown'}</div>
              <div><strong>Service Worker:</strong> {debugInfo.hasServiceWorker ? 'Supported' : 'Not Supported'}</div>
              <div><strong>Storage:</strong> Local: {debugInfo.hasLocalStorage ? 'Yes' : 'No'}, Session: {debugInfo.hasSessionStorage ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
