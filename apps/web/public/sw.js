// ColdCopy Service Worker - Enhanced PWA Implementation
const CACHE_NAME = 'coldcopy-v2';
const OFFLINE_URL = '/offline.html';
const API_CACHE_NAME = 'coldcopy-api-v1';

// Core files to cache for offline functionality
const CORE_CACHE_URLS = [
  '/',
  '/offline.html',
  '/dashboard',
  '/leads',
  '/campaigns',
  '/analytics',
  '/manifest.json'
];

// API endpoints that should work offline with cached data
const CACHE_API_PATTERNS = [
  '/api/dashboard/stats',
  '/api/leads',
  '/api/campaigns',
  '/api/analytics/overview'
];

// Network-first strategy for dynamic content
const NETWORK_FIRST_PATTERNS = [
  '/api/auth/',
  '/api/email/',
  '/api/billing/'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('SW: Installing v2...');
  
  event.waitUntil(
    Promise.all([
      // Cache core application files
      caches.open(CACHE_NAME).then((cache) => {
        console.log('SW: Caching core files');
        return cache.addAll(CORE_CACHE_URLS);
      }),
      // Create API cache
      caches.open(API_CACHE_NAME).then(() => {
        console.log('SW: API cache created');
      })
    ]).then(() => {
      console.log('SW: Installation complete');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('SW: Installation failed', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating...');
  
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Handle different request types with appropriate strategies
  if (request.mode === 'navigate') {
    // Navigation requests - network first with offline fallback
    event.respondWith(handleNavigationRequest(request));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - smart caching based on endpoint
    event.respondWith(handleApiRequest(request, url));
  } else {
    // Static assets - cache first
    event.respondWith(handleStaticRequest(request));
  }
});

// Handle navigation requests (page loads)
async function handleNavigationRequest(request) {
  try {
    // Try network first for fresh content
    const response = await fetch(request);
    
    // Cache successful navigation responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('SW: Navigation network failed, trying cache');
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to offline page
    return caches.match(OFFLINE_URL);
  }
}

// Handle API requests with intelligent caching
async function handleApiRequest(request, url) {
  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some(pattern => 
    url.pathname.startsWith(pattern)
  );
  
  const isCacheable = CACHE_API_PATTERNS.some(pattern => 
    url.pathname.startsWith(pattern)
  ) && request.method === 'GET';
  
  if (isNetworkFirst) {
    // Network-first for authentication, billing, etc.
    return handleNetworkFirst(request);
  } else if (isCacheable) {
    // Stale-while-revalidate for dashboard data
    return handleStaleWhileRevalidate(request);
  } else {
    // Network-only for mutations and sensitive operations
    return handleNetworkOnly(request);
  }
}

// Network-first strategy
async function handleNetworkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Return offline response for failed API calls
    return new Response(
      JSON.stringify({
        error: 'Network unavailable',
        message: 'This feature requires an internet connection',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Stale-while-revalidate strategy
async function handleStaleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  // Get cached response immediately if available
  const cachedResponse = await cache.match(request);
  
  // Start network request
  const networkResponsePromise = fetch(request).then(async (response) => {
    if (response.ok) {
      // Update cache with fresh data
      cache.put(request, response.clone());
    }
    return response;
  }).catch((error) => {
    console.log('SW: Network update failed', error);
    return null;
  });
  
  // Return cached response immediately, or wait for network
  return cachedResponse || networkResponsePromise || createOfflineResponse();
}

// Network-only strategy
async function handleNetworkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return createOfflineResponse();
  }
}

// Handle static assets
async function handleStaticRequest(request) {
  try {
    // Try cache first for static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network and cache
    const response = await fetch(request);
    if (response.ok && request.url.includes('_next/static')) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('SW: Static asset failed:', request.url);
    return new Response('', { status: 404 });
  }
}

// Create offline response
function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'Network unavailable',
      message: 'This feature requires an internet connection',
      offline: true
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Enhanced push notification handling
self.addEventListener('push', (event) => {
  console.log('SW: Push notification received');
  
  let notificationData = {
    title: 'ColdCopy',
    body: 'You have new activity',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    image: '/notification-image.png',
    vibrate: [100, 50, 100],
    requireInteraction: false,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open ColdCopy',
        icon: '/icon-192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-192.png'
      }
    ]
  };
  
  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.log('SW: Failed to parse push data', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification clicked', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Determine URL to open
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline operations
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  } else if (event.tag === 'retry-failed-requests') {
    event.waitUntil(retryFailedRequests());
  }
});

// Perform background sync operations
async function performBackgroundSync() {
  try {
    console.log('SW: Performing background sync');
    
    // Refresh critical cached data
    const cache = await caches.open(API_CACHE_NAME);
    
    for (const pattern of CACHE_API_PATTERNS) {
      try {
        const response = await fetch(pattern);
        if (response.ok) {
          await cache.put(pattern, response.clone());
          console.log('SW: Updated cache for:', pattern);
        }
      } catch (error) {
        console.log('SW: Failed to update:', pattern, error);
      }
    }
  } catch (error) {
    console.error('SW: Background sync failed', error);
  }
}

// Retry failed requests
async function retryFailedRequests() {
  try {
    console.log('SW: Retrying failed requests');
    // Implementation would retrieve failed requests from IndexedDB
    // and retry them when connection is restored
  } catch (error) {
    console.error('SW: Failed request retry failed', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('SW: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Force update specific cache entry
    const request = new Request(event.data.url);
    handleStaleWhileRevalidate(request);
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear all caches
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('SW: Enhanced service worker loaded successfully');