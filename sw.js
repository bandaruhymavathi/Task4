// Service Worker for E-commerce PWA
const CACHE_NAME = 'shopMart-v1.0.0';
const STATIC_CACHE = 'shopMart-static-v1';
const DYNAMIC_CACHE = 'shopMart-dynamic-v1';

// Files to cache for offline functionality
const CACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js',
    // Fallback page for offline
    '/offline.html'
];

// API endpoints to cache
const API_CACHE_URLS = [
    '/api/products',
    '/api/categories'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        (async () => {
            try {
                // Cache static files
                const staticCache = await caches.open(STATIC_CACHE);
                await staticCache.addAll(CACHE_URLS);
                
                console.log('Service Worker: Static assets cached');
                
                // Skip waiting to activate immediately
                await self.skipWaiting();
            } catch (error) {
                console.error('Service Worker: Install failed', error);
            }
        })()
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        (async () => {
            try {
                // Get all cache names
                const cacheNames = await caches.keys();
                
                // Delete old caches
                const deletePromises = cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                });
                
                await Promise.all(deletePromises);
                
                // Claim all clients
                await self.clients.claim();
                
                console.log('Service Worker: Activated successfully');
            } catch (error) {
                console.error('Service Worker: Activation failed', error);
            }
        })()
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle different types of requests with appropriate strategies
    if (request.method === 'GET') {
        if (url.pathname.startsWith('/api/')) {
            // API requests - Network First strategy
            event.respondWith(handleApiRequest(request));
        } else if (request.destination === 'image') {
            // Images - Cache First strategy
            event.respondWith(handleImageRequest(request));
        } else {
            // Static assets - Cache First with Network Fallback
            event.respondWith(handleStaticRequest(request));
        }
    }
});

// Network First strategy for API requests
async function handleApiRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache', request.url);
        
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline data if available
        return new Response(
            JSON.stringify({ 
                error: 'Offline', 
                message: 'This feature is not available offline' 
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Cache First strategy for images
async function handleImageRequest(request) {
    try {
        // Check cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache the image
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Image request failed', request.url);
        
        // Return a placeholder image
        return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f1f5f9"/><text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-size="48">📷</text></svg>',
            {
                headers: { 'Content-Type': 'image/svg+xml' }
            }
        );
    }
}

// Cache First with Network Fallback for static assets
async function handleStaticRequest(request) {
    try {
        // Check cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(request.url.includes('/api/') ? DYNAMIC_CACHE : STATIC_CACHE);
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Static request failed', request.url);
        
        // For navigation requests, return offline page
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match('/offline.html');
            if (offlineResponse) {
                return offlineResponse;
            }
            
            // Fallback offline page
            return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Offline - ShopMart</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            text-align: center; 
                            padding: 2rem; 
                            background: #f8fafc;
                            color: #1e293b;
                        }
                        .offline-container {
                            max-width: 400px;
                            margin: 2rem auto;
                            padding: 2rem;
                            background: white;
                            border-radius: 16px;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                        }
                        .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
                        .retry-btn {
                            background: #2563eb;
                            color: white;
                            border: none;
                            padding: 0.75rem 1.5rem;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 1rem;
                            margin-top: 1rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="offline-container">
                        <div class="offline-icon">📱</div>
                        <h1>You're Offline</h1>
                        <p>Check your internet connection and try again.</p>
                        <button class="retry-btn" onclick="location.reload()">Retry</button>
                    </div>
                </body>
                </html>
            `, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        // For other requests, return a generic error
        return new Response('Offline', { 
            status: 503, 
            statusText: 'Service Unavailable' 
        });
    }
}

// Push notification event
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    let notificationData = {
        title: 'ShopMart',
        body: 'You have a new notification!',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛒</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛒</text></svg>',
        data: { url: '/' }
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = { ...notificationData, ...data };
        } catch (error) {
            console.error('Service Worker: Error parsing push data', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            data: notificationData.data,
            actions: [
                {
                    action: 'open',
                    title: 'Open App'
                },
                {
                    action: 'close',
                    title: 'Dismiss'
                }
            ],
            vibrate: [200, 100, 200],
            requireInteraction: true
        })
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    // Open the app
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Open new window/tab
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Background sync event (for future enhancement)
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered');
    
    if (event.tag === 'order-sync') {
        event.waitUntil(syncPendingOrders());
    }
});

// Sync pending orders when online
async function syncPendingOrders() {
    try {
        // Get pending orders from IndexedDB or cache
        // This would sync with your backend API
        console.log('Service Worker: Syncing pending orders...');
        
        // Implementation would depend on your backend
        // For now, just log the sync attempt
    } catch (error) {
        console.error('Service Worker: Order sync failed', error);
    }
}

// Message event for communication with main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        cacheUrls(event.data.urls);
    }
});

// Cache additional URLs on demand
async function cacheUrls(urls) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.addAll(urls);
        console.log('Service Worker: URLs cached successfully');
    } catch (error) {
        console.error('Service Worker: Failed to cache URLs', error);
    }
}