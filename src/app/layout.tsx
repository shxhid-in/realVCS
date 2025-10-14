import type { Metadata } from 'next';
import './globals.css';
// Temporarily disable Google Fonts to avoid network issues during build
// import { Inter } from 'next/font/google';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../components/ThemeProvider';
import { Toaster } from '../components/ui/toaster';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getManifestUrl } from '../lib/manifest';

// Use system fonts as fallback
const inter = { 
  variable: '--font-inter',
  className: 'font-sans'
};

export const metadata: Metadata = {
  title: 'ButcherBot POS',
  description: 'A Modern Point of Sale System for Butchers',
  manifest: getManifestUrl({ slug: 'twa', baseUrl: process.env.NEXT_PUBLIC_BASE_URL || '' }),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ButcherBot POS',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'ButcherBot POS',
    title: 'ButcherBot POS',
    description: 'A Modern Point of Sale System for Butchers',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="ButcherBot POS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ButcherBot POS" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Remove browserconfig.xml reference */}
        {/* <meta name="msapplication-config" content="/icons/browserconfig.xml?v=20250929051226" /> */}
        
        {/* Icons are handled by Next.js metadata */}
        
        {/* Social meta tags */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:url" content="https://butcherbot-pos.com" />
        <meta name="twitter:title" content="ButcherBot POS" />
        <meta name="twitter:description" content="A Modern Point of Sale System for Butchers" />
        <meta name="twitter:image" content="/icons/icon-128.png" />
        <meta name="twitter:creator" content="@butcherbot" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="ButcherBot POS" />
        <meta property="og:description" content="A Modern Point of Sale System for Butchers" />
        <meta property="og:site_name" content="ButcherBot POS" />
        <meta property="og:url" content="https://butcherbot-pos.com" />
        <meta property="og:image" content="/icons/icon-128.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>{children}</AuthProvider>
            <Toaster />
          </ThemeProvider>
        </ErrorBoundary>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Enhanced service worker registration with mobile browser compatibility
              function registerServiceWorker() {
                // Check if Service Worker is supported
                if (!('serviceWorker' in navigator)) {
                  console.log('Service Worker not supported - this is normal on some mobile browsers');
                  return;
                }
                
                // Check if we're in a secure context (required for Service Workers)
                if (!window.isSecureContext && location.hostname !== 'localhost') {
                  console.log('Service Worker requires HTTPS - not available on HTTP');
                  return;
                }
                
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                  })
                  .then(function(registration) {
                    console.log('Service Worker registered successfully:', registration);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', function() {
                      console.log('Service Worker update found');
                    });
                    
                    // Handle registration success
                    window.dispatchEvent(new CustomEvent('sw-registered', { 
                      detail: { registration } 
                    }));
                  })
                  .catch(function(error) {
                    console.warn('Service Worker registration failed:', error);
                    
                    // Mobile-specific error handling
                    if (error.name === 'SecurityError') {
                      console.log('Service Worker blocked by security policy - common on mobile browsers');
                    } else if (error.name === 'NetworkError') {
                      console.log('Service Worker network error - check mobile connection');
                    } else if (error.message.includes('Failed to fetch')) {
                      console.log('Service Worker fetch failed - network issue');
                    } else {
                      console.log('Service Worker error:', error.message);
                    }
                    
                    // Handle registration failure gracefully
                    window.dispatchEvent(new CustomEvent('sw-failed', { 
                      detail: { error: error.message } 
                    }));
                  });
                });
              }
              
              // Register Service Worker with error handling
              try {
                registerServiceWorker();
              } catch (error) {
                console.log('Service Worker registration error:', error);
              }
              
              // Mobile-specific error handling
              window.addEventListener('error', function(event) {
                console.error('Global error caught:', event.error);
                
                // Check if it's a mobile-specific error
                if (event.error && event.error.message) {
                  if (event.error.message.includes('NetworkError') || 
                      event.error.message.includes('Failed to fetch')) {
                    console.warn('Mobile network error detected');
                  }
                }
              });
              
              // Handle unhandled promise rejections
              window.addEventListener('unhandledrejection', function(event) {
                console.error('Unhandled promise rejection:', event.reason);
                event.preventDefault(); // Prevent the default browser error handling
              });
              
              // Service Worker status monitoring
              window.addEventListener('sw-registered', function(event) {
                console.log('Service Worker is active and ready');
              });
              
              window.addEventListener('sw-failed', function(event) {
                console.log('Service Worker failed to register - app will work without offline features');
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
