// Service Worker Version - Increment this on every deployment to force updates
// Format: YYYY.MM.DD-RELEASE_NUMBER
const SW_VERSION = '2025.12.09-1';

// Cache names - Increment version numbers on each deployment to clear old caches
const STATIC_CACHE_NAME = 'butcherbot-static-v4';
const DYNAMIC_CACHE_NAME = 'butcherbot-dynamic-v4';

// Files to cache for offline functionality
// Note: For Next.js, these routes will be cached as HTML pages
const STATIC_FILES = [
  '/',
  '/dashboard',
  '/dashboard/analytics',
  '/dashboard/menu',
  '/dashboard/contact',
  '/admin'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Installing...`);
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files', error);
        // Mobile-specific error handling
        if (error.name === 'NetworkError' || error.message.includes('Failed to fetch')) {
          console.warn('Service Worker: Network error during install - common on mobile');
          // Continue with installation even if some files fail
          return self.skipWaiting();
        }
        throw error;
      })
  );
});

// Activate event - clean up old caches
// IMPORTANT: Cache cleanup must happen BEFORE clients.claim() to ensure old caches are deleted
// before the new service worker takes control
self.addEventListener('activate', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Activating...`);
  event.waitUntil(
    (async () => {
      // Step 1: Get all cache names
      const cacheNames = await caches.keys();
      
      // Step 2: Delete all old caches (except current ones)
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      
      // Step 3: Take control of all clients (TWA/PWA)
      // This ensures the new service worker is active immediately
      await self.clients.claim();
      
      console.log('Service Worker: Activated and claimed all clients');
    })()
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME)
        .then((cache) => {
          return fetch(request)
            .then((response) => {
              // Cache successful API responses
              if (response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch((error) => {
              console.warn('Service Worker: API fetch failed', error);
              // Return cached response if network fails
              return cache.match(request)
                .then((cachedResponse) => {
                  if (cachedResponse) {
                    console.log('Service Worker: Serving cached API response');
                    return cachedResponse;
                  }
                  // Return mobile-friendly offline fallback for API requests
                  return new Response(
                    JSON.stringify({ 
                      error: 'Mobile Network Error', 
                      message: 'Connection failed. This is common on mobile networks. Please check your connection and try again.',
                      mobile: true,
                      timestamp: new Date().toISOString()
                    }),
                    {
                      status: 503,
                      statusText: 'Service Unavailable',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                      }
                    }
                  );
                });
            });
        })
        .catch((error) => {
          console.error('Service Worker: Cache operation failed', error);
          // Fallback for cache errors
          return new Response(
            JSON.stringify({ 
              error: 'Service Worker Error', 
              message: 'Unable to process request. Please refresh the page.',
              mobile: true
            }),
            {
              status: 500,
              statusText: 'Internal Server Error',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Handle static files and pages
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cache successful responses
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/')
                .then((cachedResponse) => {
                  return cachedResponse || new Response(
                    `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>ButcherBot POS - Offline</title>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                          body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: #f5f5f5;
                          }
                          .offline-container {
                            text-align: center;
                            padding: 2rem;
                            background: white;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                          }
                          .offline-icon {
                            font-size: 4rem;
                            margin-bottom: 1rem;
                          }
                          h1 { color: #333; margin-bottom: 1rem; }
                          p { color: #666; margin-bottom: 2rem; }
                          button {
                            background: #000;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 16px;
                          }
                          button:hover { background: #333; }
                        </style>
                      </head>
                      <body>
                        <div class="offline-container">
                          <div class="offline-icon">📱</div>
                          <h1>You're Offline</h1>
                          <p>ButcherBot POS is not available offline. Please check your internet connection and try again.</p>
                          <button onclick="window.location.reload()">Try Again</button>
                        </div>
                      </body>
                    </html>
                    `,
                    {
                      headers: { 'Content-Type': 'text/html' }
                    }
                  );
                });
            }
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks
      console.log('Service Worker: Background sync triggered')
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-128.png',
      badge: '/icons/icon-128.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1
      },
      actions: [
        {
          action: 'explore',
          title: 'View Details',
          icon: '/icons/action-view.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icons/action-close.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
