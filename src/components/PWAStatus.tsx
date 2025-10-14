'use client';

import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Smartphone, Wifi, WifiOff, Download } from 'lucide-react';

export default function PWAStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Check if running as PWA
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    // Get service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        setSwRegistration(registration || null);
      });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        setSwRegistration(registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          PWA Status
        </CardTitle>
        <CardDescription>
          Current Progressive Web App status and capabilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status</span>
          <Badge variant={isOnline ? "default" : "destructive"} className="flex items-center gap-1">
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">App Mode</span>
          <Badge variant={isStandalone ? "default" : "secondary"}>
            {isStandalone ? "PWA" : "Browser"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Service Worker</span>
          <Badge variant={swRegistration ? "default" : "secondary"}>
            {swRegistration ? "Active" : "Inactive"}
          </Badge>
        </div>

        {!swRegistration && (
          <Button onClick={handleInstall} className="w-full" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Register Service Worker
          </Button>
        )}

        <div className="text-xs text-muted-foreground">
          <p>PWA features: {isStandalone ? "✓ Installed" : "✗ Not installed"}</p>
          <p>Offline support: {swRegistration ? "✓ Available" : "✗ Not available"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
